const mongoose = require("mongoose");

const agentSchema = new mongoose.Schema(
    {
        id: Number,
        name: String,
        email: String,
        phone: String,
        deptId: Number,
        avatar: String,
        subCompanyConfigId: Number,
        brn: String,
    },
    { _id: false }
);

const offplanPixxi = new mongoose.Schema(
    {
        id: Number,
        propertyId: {
            type: String,
            required: true,
            index: true,
        },
        photos: [String],
        price: Number,
        agent: agentSchema,
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "PENDING"],
            default: "ACTIVE",
        },
        description: String,
        region: String,
        regionId: String,
        cityId: Number,
        cityName: String,
        permitNumber: String,
        permitUrl: String,
        permitQRCode: String,
        developer: String,
        developerLogo: String,
        developerId: String,
        location: String,
        amenities: [String],
        size: Number,
        plotSize: Number,
        community: String,
        communityId: String,
        handoverQuarter: {
            type: String,
            default: "",
        },
        newParam: mongoose.Schema.Types.Mixed,
        rentParam: mongoose.Schema.Types.Mixed,
        sellParam: mongoose.Schema.Types.Mixed,
        isFurniture: String,
        createTime: Date,
        updateTime: Date,
        title: {
            type: String,
            required: true,
        },
        slug: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
        },
        listingType: {
            type: String,
            required: true,
        },
        listing_subtype: {
            type: String,
            enum: ["offplan", "ready"],
            default: "ready",
            index: true,
        },
        propertyType: [
            {
                type: String,
                required: true,
            },
        ],
        bedRooms: {
            type: mongoose.Schema.Types.Mixed,
            default: "0",
        },
        luxury: {
            type: Boolean,
            default: false,
        },
        bathrooms: { // Move the bathrooms field to the root level
            type: Number,
            default: null
        },
    },
    {
        timestamps: true,
    }
);


// Indexes for performance
offplanPixxi.index({ propertyId: 1 });
offplanPixxi.index({ listingType: 1, propertyType: 1 });
offplanPixxi.index({ status: 1 });

const OffplanPIXXIModel = mongoose.model("Offplan_pixxi", offplanPixxi);

module.exports = OffplanPIXXIModel;