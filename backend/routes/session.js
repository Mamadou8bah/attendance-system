const express = require('express');
const sessionStore = require('../sessionStore');

const router = express.Router();

router.get('/status', (req, res) => {
    const state = sessionStore.getState();
    const remaining = state.isActive ? Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000)) : 0;
    
    res.json({
        success: true,
        isActive: state.isActive,
        remainingSeconds: remaining,
        duration: state.duration
    });
});

router.post('/start', (req, res) => {
    const { duration } = req.body;
    const minutes = parseInt(duration) || 10; // Default 10 mins
    
    sessionStore.startSession(minutes);
    
    res.json({
        success: true,
        message: `Session started for ${minutes} minutes`,
        isActive: true,
        duration: minutes
    });
});

router.post('/stop', (req, res) => {
    sessionStore.stopSession();
    
    res.json({
        success: true,
        message: 'Session stopped',
        isActive: false
    });
});

module.exports = router;
