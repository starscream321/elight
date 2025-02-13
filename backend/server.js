const express = require('express');
const { effects } = require('./effects');
const { animationFrame, startInterval } = require('./effectHandler');
const cors = require('cors');


const app = express();
const PORT = 3001;
app.use(express.json(), cors());



let currentEffect = '';




app.post('/set-effect', async (req, res) => {
    const { effect, hueColor } = req.body;
    if (effects[effect]) {
        currentEffect = effect;
        res.send(`Effect changed to: ${effect}`);
        await startInterval(hueColor, currentEffect);
    } else {
        console.log('Effect not found:', effect);
        res.status(400).send('Invalid effect name');
    }
});


app.get('/off-led', async (req, res) => {
        currentEffect = 'off'
        await startInterval(0,currentEffect);
        setTimeout(() => {
            clearInterval(animationFrame);
        }, 1000)
        res.send(`Led off`);
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = { currentEffect };
