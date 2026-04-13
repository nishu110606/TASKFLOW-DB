import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Task text is required'],
      trim: true,
      minlength: [3, 'Task text must be at least 3 characters'],
      maxlength: [255, 'Task text cannot exceed 255 characters']
    },
    completed: {
      type: Boolean,
      default: false,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastModified: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: { createdAt: false, updatedAt: 'lastModified' }
  }
);

taskSchema.index({ text: 'text' });
taskSchema.index({ completed: 1, createdAt: -1 });

taskSchema.pre('save', function updateModified() {
  this.lastModified = new Date();
});

taskSchema.pre('findOneAndUpdate', function updateModifiedHook() {
  this.set({ lastModified: new Date() });
});

const Task = mongoose.model('Task', taskSchema);

export default Task;
