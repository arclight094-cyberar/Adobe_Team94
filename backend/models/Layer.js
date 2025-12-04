import mongoose from 'mongoose';

const layerSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    name: {
        type: String,
        default: 'Layer'
    },
    type: {
        type: String,
        enum: ['background', 'foreground', 'object', 'text', 'adjustment', 'custom'],
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    publicId: {
        type: String,
        required: true
    },
    maskUrl: {
        type: String,
        default: null
    },
    maskPublicId: {
        type: String,
        default: null
    },
    order: {
        type: Number,
        required: true,
        default: 0
    },
    visible: {
        type: Boolean,
        default: true
    },
    locked: {
        type: Boolean,
        default: false
    },
    opacity: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    blendMode: {
        type: String,
        enum: ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light'],
        default: 'normal'
    },
    position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
    },
    dimensions: {
        width: { type: Number, required: true },
        height: { type: Number, required: true }
    },
    transformations: {
        rotation: { type: Number, default: 0 },
        scaleX: { type: Number, default: 1 },
        scaleY: { type: Number, default: 1 },
        flipX: { type: Boolean, default: false },
        flipY: { type: Boolean, default: false }
    },
    metadata: {
        format: String,
        size: Number,
        originalPublicId: String
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

// Update timestamp before saving
layerSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Index for faster queries
layerSchema.index({ project: 1, order: 1 });

const Layer = mongoose.model('Layer', layerSchema);
export default Layer;
