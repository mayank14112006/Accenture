// Monochrome flat icons (Material glyphs, near-black) for the deck.
// Writes the SAME filenames the deck already references, so switching the
// icon style never touches slide layout code.
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sharp = require('sharp');
const md = require('react-icons/md');

const INK = '#23262E';

// deck filename (kept stable) -> Material icon component
const MAP = {
  FcDocument: 'MdDescription',
  FcTodoList: 'MdChecklist',
  FcIdea: 'MdLightbulb',
  FcHighPriority: 'MdWarning',
  FcFlowChart: 'MdAccountTree',
  FcConferenceCall: 'MdGroups',
  FcComboChart: 'MdInsights',
  FcGlobe: 'MdPublic',
  FcCalendar: 'MdCalendarMonth',
  FcInspection: 'MdFactCheck',
  FcApproval: 'MdVerified',
  FcLock: 'MdLock',
  FcMoneyTransfer: 'MdPayments',
  FcDataProtection: 'MdSecurity',
  FcBullish: 'MdTrendingUp',
  FcPieChart: 'MdPieChart',
  FcCurrencyExchange: 'MdCurrencyExchange',
  FcOrganization: 'MdCorporateFare',
  FcParallelTasks: 'MdAltRoute',
  FcSearch: 'MdSearch',
  FcSettings: 'MdSettings',
  FcShipped: 'MdLocalShipping',
  FcSurvey: 'MdListAlt',
  FcBarChart: 'MdBarChart',
  FcPrivacy: 'MdPrivacyTip',
  FcDeployment: 'MdRocketLaunch',
  FcTimeline: 'MdTimeline',
  FcMediumPriority: 'MdOutlinedFlag',
  FcPositiveDynamic: 'MdTrendingUp',
  FcRules: 'MdRule',
  FcServices: 'MdMiscellaneousServices',
  FcBusinessman: 'MdCoPresent',
  FcAlarmClock: 'MdSpeed',
  FcOk: 'MdCheckCircle',
  FcCancel: 'MdCancel',
  FcSupport: 'MdSupportAgent',
  FcLink: 'MdLink',
};

const outDir = path.join(__dirname, 'icons');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  let made = 0;
  for (const [file, mdName] of Object.entries(MAP)) {
    const Icon = md[mdName];
    if (!Icon) { console.log('skip (missing):', mdName, 'for', file); continue; }
    const svg = renderToStaticMarkup(
      React.createElement(Icon, { size: 256, color: INK }));
    const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    fs.writeFileSync(path.join(outDir, file + '.png'), png);
    made++;
  }
  console.log('mono icons written:', made);
})();
