const state = {
    isActive: false,
    endTime: null,
    duration: 0, // minutes
    courseId: null,
    courseSessionId: null,
    sessionNumber: null
};

module.exports = {
    getState: () => {
        // Auto-expire if time passed
        if (state.isActive && Date.now() > state.endTime) {
            state.isActive = false;
            state.endTime = null;
        }
        return state;
    },
    startSession: (durationMinutes, metadata = {}) => {
        state.isActive = true;
        state.duration = durationMinutes;
        state.endTime = Date.now() + durationMinutes * 60 * 1000;
        state.courseId = metadata.courseId || null;
        state.courseSessionId = metadata.courseSessionId || null;
        state.sessionNumber = metadata.sessionNumber || null;
    },
    stopSession: () => {
        state.isActive = false;
        state.endTime = null;
        state.duration = 0;
        state.courseId = null;
        state.courseSessionId = null;
        state.sessionNumber = null;
    }
};
