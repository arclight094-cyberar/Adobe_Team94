import mongoose from 'mongoose';

const aiProjectSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'AI Edit Project'
    },
    description: {
        type: String,
        default: ''
    },
    canvasWidth: {
        type: Number,
        default: 1080
    },
    canvasHeight: {
        type: Number,
        default: 1080
    },
    backgroundColor: {
        type: String,
        default: '#ffffff'
    },
    originalImage: {
        imageUrl: String,
        publicId: String,
        width: Number,
        height: Number,
        format: String,
        size: Number
    },
    currentImage: {
        imageUrl: String,
        publicId: String,
        width: Number,
        height: Number,
        format: String,
        size: Number
    },
    operations: [{
        operationType: {
            type: String,
            enum: ['relight', 'enhance', 'face-restore', 'style-transfer', 'remove-background', 'object-removal'],
            required: true
        },
        prompt: mongoose.Schema.Types.Mixed, // Parameters/settings used for the operation
        inputImage: {
            imageUrl: String,
            publicId: String,
            width: Number,
            height: Number
        },
        outputImage: {
            imageUrl: { type: String, required: true },
            publicId: { type: String, required: true },
            width: Number,
            height: Number,
            format: String,
            size: Number
        },
        timestamp: { type: Date, default: Date.now }
    }],
    thumbnail: {
        imageUrl: String,
        publicId: String
    },
    status: {
        type: String,
        enum: ['active', 'archived', 'deleted'],
        default: 'active'
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

// Indexes for better query performance
aiProjectSchema.index({ user: 1, status: 1, updatedAt: -1 });
aiProjectSchema.index({ 'originalImage.publicId': 1 });

// Update the updatedAt timestamp before saving
aiProjectSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Method to add AI operation and update current image
aiProjectSchema.methods.addOperation = function (operationData) {
    const newOperation = {
        operationType: operationData.operationType,
        prompt: operationData.prompt || {},
        inputImage: operationData.inputImage || this.currentImage,
        outputImage: operationData.outputImage
    };
    
    this.operations.push(newOperation);
    
    // Update current image to the output of this operation
    this.currentImage = {
        imageUrl: operationData.outputImage.imageUrl,
        publicId: operationData.outputImage.publicId,
        width: operationData.outputImage.width,
        height: operationData.outputImage.height,
        format: operationData.outputImage.format,
        size: operationData.outputImage.size
    };
    
    // Update thumbnail to latest output
    this.thumbnail = {
        imageUrl: operationData.outputImage.imageUrl,
        publicId: operationData.outputImage.publicId
    };
    
    return this.save();
};

// Method to undo last operation (revert to previous image)
aiProjectSchema.methods.undoLastOperation = function () {
    if (this.operations.length === 0) {
        throw new Error('No operations to undo');
    }
    
    // Remove last operation
    this.operations.pop();
    
    // Revert to previous image
    if (this.operations.length > 0) {
        const lastOp = this.operations[this.operations.length - 1];
        this.currentImage = { ...lastOp.outputImage };
        this.thumbnail = {
            imageUrl: lastOp.outputImage.imageUrl,
            publicId: lastOp.outputImage.publicId
        };
        return this.save();
    }
    
    // If no successful operations, revert to original
    this.currentImage = { ...this.originalImage };
    this.thumbnail = {
        imageUrl: this.originalImage.imageUrl,
        publicId: this.originalImage.publicId
    };
    
    return this.save();
};

// Method to get specific operation result
aiProjectSchema.methods.getOperationAt = function (index) {
    if (index < 0 || index >= this.operations.length) {
        throw new Error('Invalid operation index');
    }
    return this.operations[index];
};

// Method to revert to specific operation
aiProjectSchema.methods.revertToOperation = function (index) {
    if (index < -1 || index >= this.operations.length) {
        throw new Error('Invalid operation index');
    }
    
    // Remove all operations after the specified index
    this.operations = this.operations.slice(0, index + 1);
    
    // Update current image
    if (index === -1) {
        // Revert to original
        this.currentImage = { ...this.originalImage };
        this.thumbnail = {
            imageUrl: this.originalImage.imageUrl,
            publicId: this.originalImage.publicId
        };
    } else {
        const targetOp = this.operations[index];
        this.currentImage = { ...targetOp.outputImage };
        this.thumbnail = {
            imageUrl: targetOp.outputImage.imageUrl,
            publicId: targetOp.outputImage.publicId
        };
    }
    
    return this.save();
};

const seqAIProject = mongoose.model('AIProject', aiProjectSchema);
export default seqAIProject;
