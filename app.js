const express = require('express'),
  app = express(),
  http = require('http'),
  port = process.env.PORT || 80,
  bodyParser = require('body-parser'),
  puppeteer = require("puppeteer-firefox");

const allowCrossDomain = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, name, id, moderator');

  // intercept OPTIONS method
  if ('OPTIONS' == req.method) {
    res.sendStatus(200);
  }
  else {
    next();
  }
};

const server = http.createServer(app);

app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb', extended: true }));
app.use(allowCrossDomain);

const mcache = require('memory-cache');
const cache = (duration) => {
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url;
    let cachedBody = mcache.get(key);
    if (cachedBody) {
      res.send(cachedBody);
      return;
    }
    else {
      res.sendResponse = res.send;
      res.send = (body) => {
        mcache.put(key, body, duration * 1000);
        res.sendResponse(body);
      }
      next();
    }
  }
}

app.route('/v1/mystery/screenshot').post(cache(180), (req, res) => {
  console.log(`get request body : ${req.body.url}`);
  const run = async () => {
    try {
      console.log('init async function');
      // open the browser and prepare a page
      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox', '--wait-for-browser'] });
      const page = await browser.newPage();

      console.log('set viewport');

      // set the size of the viewport, so our screenshot will have the desired size
      await page.setViewport({
        width: 1920,
        height: 1080
      });

      console.log(`go to url ${req.body.url}`);

      await page.goto(req.body.url);

      console.log('wait for selector');

      await page.waitForSelector('#dvTable > table > tbody');          // wait for the selector to load
      const element = await page.$('#dvTable > table > tbody')

      console.log('take screenshot');

      await element.screenshot({
        path: 'mystery.png'
      });

      console.log('close browser');

      // close the browser 
      await browser.close();

      console.log('upload screenshot');

      const imgur = require('imgur');
      imgur.setAPIUrl('https://api.imgur.com/3/');
      imgur.getAPIUrl();
      imgur.uploadFile('mystery.png')
        .then(function (result) {
          res.status(200);
          res.json({ url: result.data.link });
          console.log(`screenshot url : ${result.data.link}`);
        });
    }
    catch (e) {
      console.log(e);
      res.status(500);
      res.json();
    }
  }

  // run the async function
  run();
});

server.listen(port, () => {
  console.log(`Serveur à l'écoute sur ${port}`);
})