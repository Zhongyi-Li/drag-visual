const sharp = require("sharp");

const outputPath = "outputs/membership-payment-flow.png";
const imageTop = 244;
const imageWidth = 600;
const imageHeight = 1304;

const screens = [
  ["/Users/ethan/Downloads/k/1.jpg", 120, 1321],
  ["/Users/ethan/Downloads/k/2.png", 720, imageHeight],
  ["/Users/ethan/Downloads/k/3.png", 1320, imageHeight],
  ["/Users/ethan/Downloads/k/4.png", 1920, imageHeight],
  ["/Users/ethan/Downloads/k/5.png", 2520, imageHeight],
  ["/Users/ethan/Downloads/k/6.jpg", 3120, imageHeight],
];

const imageLayers = async () => Promise.all(
  screens.map(async ([path, left, height]) => ({
    input: await sharp(path).resize({ width: imageWidth, height, fit: "fill" }).png().toBuffer(),
    left,
    top: imageTop,
  })),
);

const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="1680" viewBox="0 0 3840 1680">
  <style>
    .title { font-family: 'PingFang SC', 'Noto Sans CJK SC', Arial, sans-serif; fill: #16243d; font-weight: 700; }
    .step { font-family: 'PingFang SC', 'Noto Sans CJK SC', Arial, sans-serif; fill: #34435d; font-weight: 700; }
    .arrow { font-family: Arial, sans-serif; fill: #ef4444; font-weight: 700; }
  </style>
  <rect width="3840" height="244" fill="#ffffff"/>
  <text class="title" x="120" y="78" font-size="52">影剪盒会员开通与支付流程</text>
  <text x="120" y="128" font-family="'PingFang SC', 'Noto Sans CJK SC', Arial, sans-serif" fill="#718096" font-size="27">红色标注为用户在当前页面需要关注或点击的区域</text>
  <line x1="0" y1="156" x2="3840" y2="156" stroke="#7c3aed" stroke-width="6"/>
  <g text-anchor="middle">
    <text class="step" x="420" y="211" font-size="29">01 首页</text><text class="step" x="1020" y="211" font-size="29">02 个人中心</text><text class="step" x="1620" y="211" font-size="29">03 会员中心</text><text class="step" x="2220" y="211" font-size="29">04 支付确认</text><text class="step" x="2820" y="211" font-size="29">05 支付成功</text><text class="step" x="3420" y="211" font-size="29">06 订单/售后</text>
    <text class="arrow" x="720" y="212" font-size="46">→</text><text class="arrow" x="1320" y="212" font-size="46">→</text><text class="arrow" x="1920" y="212" font-size="46">→</text><text class="arrow" x="2520" y="212" font-size="46">→</text><text class="arrow" x="3120" y="212" font-size="46">→</text>
  </g>
  <ellipse cx="639" cy="1423" rx="74" ry="50" fill="none" stroke="#ef4444" stroke-width="12"/>
  <rect x="747" y="538" width="546" height="130" rx="20" fill="none" stroke="#ef4444" stroke-width="12"/>
  <ellipse cx="1620" cy="654" rx="250" ry="85" fill="none" stroke="#ef4444" stroke-width="12"/>
  <ellipse cx="1620" cy="820" rx="250" ry="48" fill="none" stroke="#ef4444" stroke-width="12"/>
  <rect x="1355" y="1362" width="530" height="94" rx="47" fill="none" stroke="#ef4444" stroke-width="10"/>
  <ellipse cx="3420" cy="870" rx="200" ry="45" fill="none" stroke="#ef4444" stroke-width="12"/>
  <text x="2820" y="1622" text-anchor="middle" font-family="'PingFang SC', 'Noto Sans CJK SC', Arial, sans-serif" font-size="36" font-weight="700" fill="#ef4444">支付成功</text>
</svg>`);

(async () => {
  await sharp({
    create: { width: 3840, height: 1680, channels: 4, background: "#ffffff" },
  })
    .composite([...await imageLayers(), { input: overlay, top: 0, left: 0 }])
    .png()
    .toFile(outputPath);
})();
