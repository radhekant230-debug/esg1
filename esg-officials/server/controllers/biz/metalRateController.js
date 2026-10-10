const BizMetalRate = require("../../models/biz/BizMetalRate");

exports.getMetalRates = async (req, res) => {
    try {
        // Return latest rate per metalType + purity
        const rates = await BizMetalRate.find({ business: req.bizId })
            .sort({ effectiveDate: -1 })
            .limit(100);
        res.json(rates);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.setMetalRate = async (req, res) => {
    try {
        const { metalType, purity, ratePerGram, ratePerTola } = req.body;
        if (!metalType || !ratePerGram) {
            return res.status(400).json({ message: "metalType and ratePerGram required" });
        }
        const rate = await BizMetalRate.create({
            business: req.bizId,
            metalType,
            purity: purity || "",
            ratePerGram: Number(ratePerGram),
            ratePerTola: ratePerTola ? Number(ratePerTola) : +(ratePerGram * 11.664).toFixed(2),
            effectiveDate: new Date(),
            updatedBy: req.user._id,
        });
        res.status(201).json({ message: "Rate recorded", rate });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};
