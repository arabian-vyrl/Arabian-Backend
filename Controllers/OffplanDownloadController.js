const nodemailer = require("nodemailer");
const OffplanDownload = require("../Models/OffplanDownloadModel");
const salesforceService = require("../services/SalesforceService");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODE_MAILER_EMAIL,
    pass: process.env.NODE_MAILER_PASSWORD,
  },
});

const createOffplanDownload = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, source, type } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !phone || !source || !type) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }

    // 1. Save to database
    const download = new OffplanDownload({
      firstName,
      lastName,
      email,
      phone,
      propertyLink: source,
      downloadType: type,
    });

    await download.save();

    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    res.status(200).json({
      success: true,
      message: `${typeLabel} request submitted successfully.`,
    });

    // 2. Send admin email
    const adminMailOptions = {
      from: `"${typeLabel} Request" <${process.env.NODE_MAILER_EMAIL}>`,
      to: process.env.NODE_MAILER_EMAIL,
      subject: `New ${typeLabel} Download Request`,
      html: `
        <h3>New Download Request</h3>
        <p><strong>First Name:</strong> ${firstName}</p>
        <p><strong>Last Name:</strong> ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Property Link:</strong>
          <a href="${source}" target="_blank">${source}</a>
        </p>
        <p><strong>Download Type:</strong> ${type}</p>
      `,
    };
    await transporter.sendMail(adminMailOptions);
    await OffplanDownload.findByIdAndUpdate(download._id, {
      emailSent: true,
    });

    try {
      await transporter.sendMail(adminMailOptions);
      await OffplanDownload.findByIdAndUpdate(download._id, {
        emailSent: true,
      });
    } catch (emailError) {
      await OffplanDownload.findByIdAndUpdate(download._id, {
        emailSent: false,
      });
    }

    const salesforceData = {
      first_name: firstName,
      last_name: lastName,
      email: email,
      tele_phone: phone,


      source: "Website",
      record_type: "Off Plan enquiry",
      record_type_api_name: "Off_Plan_Enquiry", 
      lead_source: "Website",
      lead_channel: "Form",
      lead_source_contact: "Off Plan download",
      leads_default_owner: "info@arabianestates.ae",
    };

    salesforceService.syncWithRetry(OffplanDownload, download._id, salesforceData);

  } catch (error) {
    console.error("Error processing download request:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing download request.",
      error: error.message,
    });
  }
};

const getOffplanDownloads = async (req, res) => {
  try {
    const downloads = await OffplanDownload.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: downloads });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

const deleteOffplanDownload = async (req, res) => {
  try {
    const download = await OffplanDownload.findByIdAndDelete(req.query.id);
    if (!download) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Record deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

module.exports = {
  createOffplanDownload,
  getOffplanDownloads,
  deleteOffplanDownload,
};