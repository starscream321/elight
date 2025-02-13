const express = require('express');
const { effects } = require('./effects');
const { animationFrame, startInterval } = require('./effectHandler');
const cors = require('cors');

const app = express();
const PORT = 3001;


app.use(express.json());
app.use(cors());

let currentEffect = '';

app.post('/set-effect', async (req, res) => {
    const { effect, hueColor } = req.body;

    if (effects[effect]) {
        currentEffect = effect;
        await startInterval(hueColor, currentEffect);
        return res.send(`Effect changed to: ${effect}`);
    }

    console.log('Effect not found:', effect);
    return res.status(400).send('Invalid effect name');
});

// Route to turn off the LEDs
app.get('/off-led', async (req, res) => {
    currentEffect = 'off';
    await startInterval(0, currentEffect);

    setTimeout(() => {
        if (animationFrame) {
            clearInterval(animationFrame);
        }
    }, 1000);

    return res.send('LEDs turned off');
});


app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = { currentEffect };