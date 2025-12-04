import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'Untitled Project'
    },
    originalImage: {
        imageUrl: String,
        publicId: String,
        width: Number,
        height: Number,
        format: String,
        size: Number
    },
    layers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Layer'
    }],
    canvas: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        backgroundColor: { type: String, default: '#ffffff' }
    },
    thumbnail: {
        imageUrl: String,
        publicId: String
    },
    history: [{
        action: String,
        timestamp: { type: Date, default: Date.now },
        layerId: mongoose.Schema.Types.ObjectId,
        description: String,
        snapshot: mongoose.Schema.Types.Mixed
    }],
    maxHistorySteps: {
        type: Number,
        default: 50
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
projectSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Method to add history entry
projectSchema.methods.addHistory = function (historyData) {
    this.history.push(historyData);
    
    // Keep only the last N history entries
    if (this.history.length > this.maxHistorySteps) {
        this.history = this.history.slice(-this.maxHistorySteps);
    }
    
    return this.save();
};

const layerProject = mongoose.model('Project', projectSchema);
export default layerProject;
