const { chromium } = require(process.env.CUBRID_PLAYWRIGHT);
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const root = process.env.CUBRID_PROBE_DIR;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CUBRID_CHROMIUM, args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    if (process.env.CUBRID_CASE === 'roots2') {
      const url = new URL(process.argv[2]);
      url.search = `?folder=${root}/workspace`;
      await page.goto(url.toString(), {waitUntil:'domcontentloaded', timeout:60000});
      await page.locator('.monaco-workbench').waitFor({timeout:60000});
      const trustFolder = page.getByRole('button', {name:'Yes, I trust the authors'});
      await trustFolder.waitFor({state:'visible', timeout:15000}).then(() => trustFolder.click()).catch(() => {});
      await page.waitForTimeout(2000);
    }
    await page.goto(process.argv[2], {waitUntil:'domcontentloaded', timeout:60000});
    await page.locator('.monaco-workbench').waitFor({timeout:60000});
    const trust = page.getByRole('button', {name:process.env.CUBRID_CASE === 'untrusted' ? "No, I don't trust the authors" : 'Yes, I trust the authors'});
    await trust.waitFor({state:'visible', timeout:15000}).then(() => trust.click()).catch(() => {});
    let captured = false;
    let notificationRequest;
    for (let n = 0; n < 180 && !fs.existsSync(path.join(root, 'result.json')); n++) {
      const requestFile = path.join(root, 'notification-request.json');
      if (fs.existsSync(requestFile)) {
        const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
        if (request.id !== notificationRequest) {
          const rows = await page.locator('.notification-list-item').evaluateAll(nodes => nodes.map(node => ({text:node.textContent, severity:node.querySelector('.codicon-warning') ? 'warning' : node.querySelector('.codicon-error') ? 'error' : 'information'})));
          if (rows.some(row => row.text.includes(request.needle))) {
            fs.writeFileSync(path.join(root, `notifications-${request.id}.json`), JSON.stringify(rows, null, 2));
            await page.screenshot({path:path.join(root, `notifications-${request.id}.png`)});
            notificationRequest = request.id;
          }
        }
      }
      if (!captured && fs.existsSync(path.join(root, 'syntax-ready'))) {
        await page.screenshot({path:path.join(root, 'syntax.png')});
        const tokens = await page.locator('.view-line span').evaluateAll(nodes => nodes.map(node => ({text:node.textContent, class:node.className})).filter(node => node.text));
        fs.writeFileSync(path.join(root, 'syntax-tokens.json'), JSON.stringify(tokens, null, 2));
        fs.writeFileSync(path.join(root, 'syntax-captured'), 'done');
        captured = true;
      }
      await page.waitForTimeout(1000);
    }
    await page.screenshot({path:path.join(root, 'workbench.png')});
    if (!fs.existsSync(path.join(root, 'result.json'))) throw new Error('Probe did not finish');
    const result = JSON.parse(fs.readFileSync(path.join(root, 'result.json')));
    if (process.env.CUBRID_CASE === 'untrusted') {
      result.checks.untrustedNotifications = await page.locator('.notification-list-item').allTextContents();
      if (result.checks.untrustedNotifications.some(text => text.includes('CUBRID'))) throw new Error('CUBRID notification appeared in an untrusted workspace');
    }
    result.browser = browser.version();
    fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2));
    if (!result.ok) throw new Error(result.error);
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
