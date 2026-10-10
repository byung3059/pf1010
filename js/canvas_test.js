/* canvas.js — .canvas_wrap 안에 유리 모핑 WebGL 렌더
   필요: three.js r128 (canvas.js보다 먼저 로드)
   설정: canvas.js보다 먼저 window.GLASS_CONFIG = { ... } 로 덮어쓰기 (빠진 값은 아래 기본값) */
(async () => {
	const CFG = Object.assign(
		{
			bgColor: "#000000", // 배경색
			textColor: "#ffffff", // 타이틀 글자색
			pointColor: "#9b0000", // 포인트 점 색
			glassColor: "#ffffff", // 유리 색 (흰색 = 무색)
			clear: [0, 1, 0], // 도형별 투명도 0~1 (너트, 링, 큐브)
			chroma: 0.55, // 무지개 번짐 세기 (0 = 번짐 없음)
			saturation: 1.12, // 채도 (0 = 흑백)
			refraction: 0.32, // 굴절 세기
			shine: 1.0, // 반사광(하이라이트) 세기
			edgeRainbow: 0, // 모서리 무지개 세기 0~1
			edgeDark: 0, // 모서리 어두운 테두리 0~1 (밝은 배경일 때 윤곽용)
			blur: 0.1, // 유리 속 번짐(블러) 0 = 선명
			rainbowFrom: 0.5, // 무지개가 시작되는 기울기 0~1 (낮을수록 면 전체로 넓게)
			rainbowDeep: 0, // 무지개 진하기 0~1 (1 = 진한 빨강·남색까지 프리즘처럼)
			rimWhite: 0.8, // 실루엣 흰 테두리 0~1
			bodyShade: 0, // 몸통 음영 0~1 (흰 배경에서 입체감)
			darkReflect: 0, // 어두운 반사 띠 세기 0~1 (스튜디오 유리 느낌)
			reflectFringe: 0.04, // 반사 띠 경계의 색 갈라짐 폭
			lightReflect: 0, // 밝은 반사 띠 세기 0~1 (어두운 배경에서 입체감)
			envReflect: 0, // [TEST] 스튜디오 조명 반사 0~2: 위·옆 조명판이 비쳐 모서리엔 가는 흰 선, 정면은 어둡게 (어두운 유리 느낌)
			bloom: 0, // [TEST] 밝은 부분 주변 은은한 빛 번짐 0~1
			edgeLine: 0, // [TEST] 각진 모서리마다 가는 흰 하이라이트 선 0~2
			dragSpeed: 0.008, // 드래그 회전 감도 (px당 라디안)
			dragInertia: 0.95, // 놓은 뒤 관성 0~1 (1에 가까울수록 오래 돎)
			bgColor2: "", // 배경 그라데이션 두 번째 색 (마우스를 따라다님). 비우면 단색
			bgGlowSize: 0.55, // 그라데이션 크기 (화면 대각선 대비 0~1)
			bgGlowEase: 0.08, // 마우스 따라가는 속도 0~1 (낮을수록 느리고 부드럽게)
			fontFamily: "Unbounded", // 타이틀 폰트 (페이지에 로드된 폰트)
			textWeight: 900, // 타이틀 굵기
			textSize: 120, // 타이틀 크기(px) — 화면 1024px 초과
			textSizeM: 11.5, // 타이틀 크기(vw) — 화면 1024px 이하
			lineHeight: 1, // 줄 간격 (글자 크기 배수)
			textAlign: "center", // 가로 정렬: "left" | "center" | "right"
			textVAlign: "center", // 세로 정렬: "top" | "center" | "bottom"
			textX: 0, // 가로 여백(px): left면 왼쪽에서, right면 오른쪽에서, center면 가운데에서 이동(+오른쪽)
			textY: 0, // 세로 여백(px): top이면 위에서, bottom이면 아래에서, center면 가운데에서 이동(+아래)
			morph: 1.6, // 변형 시간(초)
			startShape: 0, // 처음 보이는 도형 (0 너트, 1 링, 2 큐브)
			mobileDpr: 1.5, // 모바일 최대 해상도 배율 (PC는 2)
			mobileSamples: 8, // 모바일 유리 셰이더 샘플 수 (PC는 16, 낮을수록 가볍고 번짐이 거칠어짐)
		},
		window.GLASS_CONFIG || {},
	);
	// 배경 그라데이션은 전역 설정(CURSOR_CONFIG.glow*)을 따름 — GLASS_CONFIG에 직접 적으면 그 값 우선
	const CC = window.CURSOR_CONFIG || {},
		GC = window.GLASS_CONFIG || {};
	if (GC.bgColor2 === undefined && CC.glowColor !== undefined) CFG.bgColor2 = CC.glowColor;
	if (GC.bgGlowSize === undefined && CC.glowSize !== undefined) CFG.bgGlowSize = CC.glowSize;
	if (GC.bgGlowEase === undefined && CC.glowEase !== undefined) CFG.bgGlowEase = CC.glowEase;
	["bgColor", "bgColor2", "textColor", "pointColor", "glassColor"].forEach((k) => (CFG[k] = String(CFG[k]).trim()));
	if (!Array.isArray(CFG.clear) || CFG.clear.length < 3) CFG.clear = [0, 1, 0];
	// 변형 중 조각 효과: 도형이 바뀌는 도중에 둘레가 조각(블록)으로 갈라졌다가 다음 도형으로 모임
	// (GLASS_CONFIG.shatter 로 일부만 덮어써도 됨)
	CFG.shatter = Object.assign(
		{
			amount: 0.8, // 조각나는 정도 0~1 (0 = 조각 없이 매끄럽게, 1 = 중간에 완전히 조각 상태)
			count: 6, // 조각 개수
			inner: 0.45, // 중심에서 조각 안쪽 끝까지 거리
			length: 1.65, // 조각 길이 (바깥 방향)
			width: 1.05, // 조각 폭
			thick: 0.42, // 조각 두께
			round: 0.14, // 모서리 둥글기
			twist: 30, // 프로펠러처럼 비튼 각도(도)
			skew: 24, // 중심에서 옆으로 비껴 나가는 각도(도)
		},
		(window.GLASS_CONFIG || {}).shatter || {},
	);
	const MORPH = CFG.morph;
	// [TEST] 추가 인터랙션 (GLASS_CONFIG.fx 로 덮어쓰기)
	CFG.fx = Object.assign(
		{
			intro: true, // 첫 진입: 타이틀 줄별로 올라옴 + 도형 회전하며 등장
			lens: 0.35, // 마우스 주변 타이틀 렌즈 왜곡 세기 0~1 (0 = 끔, 모바일은 자동으로 끔)
			lensSize: 220, // 렌즈 반경(px)
			ripple: 1, // 클릭 시 퍼지는 파동 세기 (0 = 끔)
			parallax: 0.35, // 마우스 방향으로 도형이 따라 움직이는 거리
			scroll: true, // 스크롤하면 도형 회전·확대 + 타이틀 위로 사라짐 (#project_visual 높이 필요)
			scrollChroma: 1.2, // 스크롤 속도만큼 무지개 번짐 증가
			autoMorph: 3, // 자동 변형 간격(초): 변형이 시작되는 시점끼리의 간격 (0 = 끔, 클릭 변형은 그대로)
			spin: 0.6, // 도형이 계속 도는 속도(라디안/초, 세로축) — 0 = 기존처럼 살짝 흔들리기만
			flute: 8, // 유리 칸막이(가로·세로 골 유리)에서 이미지가 어긋나는 최대 거리(px) — 글자·도형 앞에 화면 전체로 깔림 (0 = 끔)
			fluteWidth: 40, // 골 하나의 폭(px)
			fluteText: 4, // 글자(타이틀·PROJECT)가 어긋나는 최대 거리(px) — 도형은 flute 값
		},
		(window.GLASS_CONFIG || {}).fx || {},
	);

	const wrap = document.querySelector(".canvas_wrap");
	if (!wrap) return;
	if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
	const canvas = document.createElement("canvas");
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
	wrap.appendChild(canvas);

	// 모바일(마우스 없는 터치 기기)은 GPU 부담을 줄임: 해상도 배율·유리 셰이더 샘플 수·안티앨리어싱
	const MOBILE = matchMedia("(hover: none) and (pointer: coarse)").matches;
	const SAMPLES = Math.max(1, Math.round(MOBILE ? CFG.mobileSamples : 16));

	// WebGL을 못 쓰면 DOM 타이틀을 대신 보여줌 (흰 화면 방지)
	let renderer;
	try {
		if (!window.THREE) throw new Error("three.js not loaded");
		renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE });
	} catch (e) {
		canvas.remove();
		(wrap.closest("#project_visual") || document.body).classList.add("is-no-webgl");
		return;
	}
	const DPR = Math.min(window.devicePixelRatio || 1, MOBILE ? CFG.mobileDpr : 2);
	renderer.setPixelRatio(DPR);
	renderer.setClearColor(new THREE.Color(CFG.bgColor), 1);
	renderer.autoClear = false;

	/* ---------- 타이틀 텍스처: .slg .tit h2 문구를 캔버스에 그려 유리 뒤 배경으로 사용 ---------- */
	const titleEl = document.querySelector(".slg .tit h2");
	const lines = [""]; // <br> 기준 줄 나눔
	let pointText = "";
	if (titleEl) {
		titleEl.childNodes.forEach((nd) => {
			if (nd.nodeName === "BR") lines.push("");
			else if (nd.classList && nd.classList.contains("point")) pointText = nd.textContent.trim();
			else lines[lines.length - 1] += nd.textContent;
		});
		for (let i = 0; i < lines.length; i++) lines[i] = lines[i].trim().toUpperCase();
		// 마지막 줄 끝의 "."은 빨간 포인트 점으로 대체 (visual_cube.js와 동일 처리)
		if (pointText) lines[lines.length - 1] = lines[lines.length - 1].replace(/\.$/, "");
		titleEl.style.opacity = 0; // DOM 타이틀은 숨김 (마크업/SEO 유지)
	} else {
		lines[0] = "DETAIL";
		lines.push("ORIENTED");
		pointText = ".";
	}
	try {
		await document.fonts.load(`${CFG.textWeight} 120px "${CFG.fontFamily}"`);
	} catch (e) {}

	const tc = document.createElement("canvas");
	const tctx = tc.getContext("2d");
	const textTex = new THREE.CanvasTexture(tc);
	textTex.minFilter = THREE.LinearFilter;
	textTex.generateMipmaps = false;
	// [TEST] 프로젝트 섹션 타이틀: 스크롤하면 도형 앞에서 아래 → 위로 빨려 올라오며 등장
	const projEl = document.querySelector("#project_site > h2");
	const projText = projEl ? projEl.textContent.trim().toUpperCase() : "PROJECT";
	const pc = document.createElement("canvas");
	const pctx = pc.getContext("2d");
	const projTex = new THREE.CanvasTexture(pc);
	projTex.minFilter = THREE.LinearFilter;
	projTex.generateMipmaps = false;

	/* 반응형: GLASS_CONFIG.responsive = { 1440: {...}, 768: {...} }
	   CSS의 max-width 미디어 쿼리처럼 화면 너비가 그 값 이하일 때 덮어씀 (작은 쪽이 우선)
	   breakpoint에 textSize(px)를 적으면 1024px 이하의 textSizeM(vw) 규칙보다 우선 */
	const RESP_KEYS = ["textColor", "pointColor", "fontFamily", "textWeight", "textSize", "textSizeM", "lineHeight", "textAlign", "textVAlign", "textX", "textY"];
	const BASE = {};
	RESP_KEYS.forEach((k) => (BASE[k] = CFG[k]));
	const RESP = CFG.responsive || {};
	const BPS = Object.keys(RESP)
		.map(Number)
		.filter((n) => !isNaN(n))
		.sort((a, b) => b - a); // 큰 값부터 적용 → 작은 값이 마지막에 덮어씀
	let sizePx = false; // true면 화면 크기와 상관없이 textSize(px) 사용
	function applyResponsive() {
		const vw = window.innerWidth;
		Object.assign(CFG, BASE);
		sizePx = false;
		BPS.forEach((bp) => {
			if (vw > bp) return;
			const o = RESP[bp] || {};
			RESP_KEYS.forEach((k) => o[k] !== undefined && (CFG[k] = typeof o[k] === "string" ? o[k].trim() : o[k]));
			if (o.textSizeM !== undefined) sizePx = false;
			if (o.textSize !== undefined) sizePx = true;
		});
	}
	function redrawTitle(W, H) {
		applyResponsive();
		drawTitle(W, H);
		drawProj(W, H);
		// breakpoint에서 폰트/굵기를 바꿨는데 아직 안 불러왔으면 불러온 뒤 다시 그림
		const fk = `${CFG.textWeight} 120px "${CFG.fontFamily}"`;
		if (!document.fonts.check(fk)) document.fonts.load(fk).then(() => drawTitle(W, H), () => {});
	}

	// [TEST] 글자별 애니메이션 — 기존 PROJECT 타이틀(project_featured.js)과 같은 방식
	//   v: -1 = 아래 마스크 밖(+10°) / 0 = 제자리 / 1 = 위 마스크 밖(-10°)  (yPercent ±100 + rotation ±10°)
	const titleChars = lines.map((ln, i) => Array.from(ln + (i === lines.length - 1 ? pointText : "")).map(() => ({ v: CFG.fx.intro ? -1 : 0 })));
	const titleFlat = titleChars.flat();
	const projChars = Array.from(projText).map(() => ({ v: -1 }));
	let txtDirty = false; // 트윈 중이면 다음 프레임에 다시 그림
	// 한 줄을 글자별로: 줄마다 마스크(clip) 안에서 글자가 위·아래로 이동 + 회전
	function drawCharsLine(ctx, str, x, y, states, colorAt, capH, fs, lh, W) {
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, y - capH - fs * 0.2, W, capH + fs * 0.45);
		ctx.clip();
		for (let k = 0; k < str.length; k++) {
			const v = states[k].v;
			const ch = str[k];
			if (Math.abs(v) >= 1 || ch === " ") continue;
			const cx = x + ctx.measureText(str.slice(0, k)).width;
			const cw = ctx.measureText(ch).width;
			ctx.save();
			// 글자 가운데 기준 회전 (CSS transform-origin: center와 동일)
			ctx.translate(cx + cw / 2, y - capH / 2 - v * lh * 1.1);
			ctx.rotate((-v * 10 * Math.PI) / 180);
			ctx.fillStyle = colorAt(k);
			ctx.fillText(ch, -cw / 2, capH / 2);
			ctx.restore();
		}
		ctx.restore();
	}
	function drawTitle(W, H) {
		const nw = Math.max(2, Math.floor(W * DPR)),
			nh = Math.max(2, Math.floor(H * DPR));
		if (tc.width !== nw) tc.width = nw; // 크기가 같으면 재할당 안 함 (애니메이션 중 매 프레임 다시 그리므로)
		if (tc.height !== nh) tc.height = nh;
		tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
		// 배경색·그라데이션은 셰이더에서 칠함 (마우스 추적) → 여기선 글자만 투명 캔버스에
		tctx.clearRect(0, 0, W, H);
		// 크기: 화면 1024px 초과면 textSize(px), 이하면 textSizeM(vw) — responsive에서 textSize를 적은 구간은 textSize(px)
		const fs = !sizePx && W <= 1024 ? (W * CFG.textSizeM) / 100 : CFG.textSize;
		const lh = fs * CFG.lineHeight;
		tctx.font = `${CFG.textWeight} ${fs}px ${CFG.fontFamily}, "Arial Black", sans-serif`;
		tctx.textAlign = "left";
		tctx.textBaseline = "alphabetic";
		// 대문자 높이(글자 윗선~기준선)로 실제 보이는 글자 끝에 맞춰 정렬
		const capH = tctx.measureText("H").actualBoundingBoxAscent || fs * 0.72;
		const n = lines.length;
		// 첫 줄 기준선 위치: top = 위에서 textY / bottom = 아래에서 textY / center = 가운데 + textY
		const firstBase =
			CFG.textVAlign === "top" ? CFG.textY + capH : CFG.textVAlign === "bottom" ? H - CFG.textY - lh * (n - 1) : H / 2 - (capH + lh * (n - 1)) / 2 + capH + CFG.textY;
		lines.forEach((ln, i) => {
			const isLast = i === n - 1;
			const m1 = tctx.measureText(ln);
			const w1 = m1.width;
			const w2 = isLast && pointText ? tctx.measureText(pointText).width : 0;
			const w = w1 + w2;
			// 가로: left = 왼쪽에서 textX / right = 오른쪽에서 textX / center = 가운데 + textX
			const x =
				CFG.textAlign === "left"
					? CFG.textX + (m1.actualBoundingBoxLeft || 0) // 글자 좌측 여백 보정 → 잉크가 정확히 textX에서 시작
					: CFG.textAlign === "right"
						? W - w - CFG.textX
						: W / 2 - w / 2 + CFG.textX;
			const y = firstBase + lh * i;
			const str = ln + (isLast ? pointText : "");
			// 마지막 줄 끝 포인트(.)는 pointColor
			drawCharsLine(tctx, str, x, y, titleChars[i], (k) => (k >= ln.length ? CFG.pointColor : CFG.textColor), capH, fs, lh, W);
		});
		textTex.needsUpdate = true;
	}

	// [TEST] PROJECT 글자: 타이틀과 같은 폰트·크기로 화면 가운데, 글자별로 아래에서 회전하며 올라옴
	function drawProj(W, H) {
		const nw = Math.max(2, Math.floor(W * DPR)),
			nh = Math.max(2, Math.floor(H * DPR));
		if (pc.width !== nw) pc.width = nw;
		if (pc.height !== nh) pc.height = nh;
		pctx.setTransform(DPR, 0, 0, DPR, 0, 0);
		pctx.clearRect(0, 0, W, H);
		const fs = !sizePx && W <= 1024 ? (W * CFG.textSizeM) / 100 : CFG.textSize;
		pctx.font = `${CFG.textWeight} ${fs}px ${CFG.fontFamily}, "Arial Black", sans-serif`;
		pctx.textAlign = "left";
		pctx.textBaseline = "alphabetic";
		const capH = pctx.measureText("H").actualBoundingBoxAscent || fs * 0.72;
		const w = pctx.measureText(projText).width;
		drawCharsLine(pctx, projText, W / 2 - w / 2, H / 2 + capH / 2, projChars, () => CFG.textColor, capH, fs, fs * CFG.lineHeight, W);
		projTex.needsUpdate = true;
	}

	/* ---------- 배경(텍스트) 패스 ---------- */
	const res = { value: new THREE.Vector2(1, 1) };
	const glow = { value: new THREE.Vector2(0, 0) }; // 그라데이션 중심(px, 캔버스 좌표 · 아래가 0)
	// [TEST] 셰이더 공용 값
	const lensPos = { value: new THREE.Vector2(-9999, -9999) };
	const lensAmt = { value: 0 };
	const rip = { value: new THREE.Vector3(0, 0, 99) }; // x, y(px), 경과 시간
	const textShift = { value: 0 };
	const textA = { value: 1 };
	const projA = { value: 1 }; // PROJECT 투명도 (사라질 때는 글자 효과로 처리하므로 1 고정)
	// 색 + 투명도 파싱: "rgba(r,g,b,a)" / "#rrggbbaa" / 일반 색 → { color, alpha }
	function parseRGBA(str) {
		const s = String(str || "").trim();
		let m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i);
		if (m) {
			let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
			return { color: new THREE.Color(m[1] / 255, m[2] / 255, m[3] / 255), alpha: a };
		}
		m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
		if (m) return { color: new THREE.Color("#" + m[1]), alpha: parseInt(m[2], 16) / 255 };
		return { color: new THREE.Color(s || "#000"), alpha: 1 };
	}
	const bg2 = parseRGBA(CFG.bgColor2);
	const bgMat = new THREE.ShaderMaterial({
		uniforms: {
			tText: { value: textTex },
			uRes: res,
			uBg1: { value: new THREE.Color(CFG.bgColor) },
			uBg2: { value: bg2.color },
			uHas2: { value: CFG.bgColor2 ? 1 : 0 },
			uBg2A: { value: bg2.alpha }, // bgColor2 투명도
			uGlow: glow,
			uGlowSize: { value: CFG.bgGlowSize },
			// [TEST] 렌즈 / 파동 / 스크롤
			uLens: lensPos,
			uLensAmt: lensAmt,
			uLensR: { value: CFG.fx.lensSize * DPR },
			uRip: rip,
			uRipAmt: { value: CFG.fx.ripple },
			uDpr: { value: DPR },
			uShift: textShift,
			uTextA: textA,
		},
		vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
		fragmentShader: `
      uniform sampler2D tText; uniform vec2 uRes, uGlow, uLens; uniform vec3 uBg1, uBg2, uRip;
      uniform float uHas2, uGlowSize, uBg2A, uLensAmt, uLensR, uRipAmt, uDpr, uShift, uTextA;
      varying vec2 vUv;
      vec4 tex(vec2 uv){
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
        return texture2D(tText, uv);
      }
      void main(){
        vec3 bg = uBg1;
        if (uHas2 > 0.5) {
          // 마우스 위치 중심 원형 그라데이션: 가운데 bgColor2 → 바깥 bgColor
          float d = length(gl_FragCoord.xy - uGlow) / length(uRes);
          bg = mix(uBg1, uBg2, (1.0 - smoothstep(0.0, uGlowSize, d)) * uBg2A);
        }
        vec2 p = gl_FragCoord.xy;
        vec2 off = vec2(0.0);
        // 렌즈: 마우스 주변을 끌어당겨 돋보기처럼 부풀림
        vec2 ld = p - uLens;
        float lf = 1.0 - smoothstep(0.0, uLensR, length(ld));
        off -= ld * smoothstep(0.0, 1.0, lf) * uLensAmt;
        // 파동: 클릭 지점에서 링이 퍼져 나감 (uRip.z = 경과 시간)
        if (uRipAmt > 0.0 && uRip.z < 1.6) {
          vec2 rd = p - uRip.xy;
          float rl = length(rd) + 1e-4;
          float wpx = 70.0 * uDpr;
          float k = rl - uRip.z * length(uRes) * 0.55;
          float w = exp(-(k * k) / (wpx * wpx)) * (1.0 - uRip.z / 1.6);
          off += rd / rl * sin(k / wpx * 3.14159) * w * uRipAmt * 28.0 * uDpr;
        }
        vec2 uv = (p + off) / uRes;
        // 왜곡된 만큼 RGB 갈라짐
        vec2 sp = off / uRes * 0.18;
        vec4 ta = tex(uv + sp), tb = tex(uv), tc = tex(uv - sp);
        vec3 col = vec3(
          mix(bg.r, ta.r, ta.a * uTextA),
          mix(bg.g, tb.g, tb.a * uTextA),
          mix(bg.b, tc.b, tc.a * uTextA));
        gl_FragColor = vec4(col, 1.0);
      }`,
		depthTest: false,
		depthWrite: false,
	});
	const bgScene = new THREE.Scene();
	bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));
	const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

	// [TEST] PROJECT 오버레이: 유리 도형 앞에 그림 (굴절 안 됨)
	const projMat = new THREE.ShaderMaterial({
		// [TEST] 투명 레이어에 그려도 알파가 맞게 (색은 프리멀티플라이, 알파는 그대로 누적)
		blending: THREE.CustomBlending,
		blendSrc: THREE.SrcAlphaFactor,
		blendDst: THREE.OneMinusSrcAlphaFactor,
		blendSrcAlpha: THREE.OneFactor,
		blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
		uniforms: { tProj: { value: projTex }, uRes: res, uProjA: projA },
		vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
		fragmentShader: `
      uniform sampler2D tProj; uniform vec2 uRes; uniform float uProjA;
      void main(){
        vec4 c = texture2D(tProj, gl_FragCoord.xy / uRes);
        gl_FragColor = vec4(c.rgb, c.a * uProjA);
      }`,
		transparent: true,
		depthTest: false,
		depthWrite: false,
	});
	const projScene = new THREE.Scene();
	projScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), projMat));

	/* ---------- 도형: 피라미드(A) ↔ 사각 바(B) 모핑 ---------- */
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
	camera.position.set(0, 0, 10);

	/* 모든 도형을 같은 토폴로지(각도 N분할 × 단면 4변: 바깥벽/윗면/안쪽벽/아랫면)로 생성
     → 정점 수가 같아서 셰이더에서 바로 보간 가능. 속이 찬 도형은 안쪽 반지름 0 */
	const N = 120; // [TEST] 4·6·8·10각 꼭짓점이 모두 샘플에 걸리도록 4·6·8·10의 공배수
	const polyR = (n, R, corner) => (th) => {
		// 정n각형의 각도별 반지름
		const seg = (Math.PI * 2) / n;
		const l = (((th - corner) % seg) + seg) % seg;
		return (R * Math.cos(Math.PI / n)) / Math.cos(l - Math.PI / n);
	};
	const zero = () => 0;
	/* 단면(프로필)을 4변 × S분할 = K점으로 통일 → 링처럼 곡면인 도형도 같은 정점 수로 표현 */
	const S = 16,
		K = S * 4;
	const P = (th, r, y) => [Math.cos(th) * r, y, Math.sin(th) * r];
	// 직선 4변 프로필: 바깥벽 → 윗면 → 안쪽벽 → 아랫면
	const lineProf = (o) => (th) => {
		const c = [
			[o.outB(th), o.y0],
			[o.outT(th), o.y1],
			[o.inT(th), o.y1],
			[o.inB(th), o.y0],
		];
		const pts = [];
		for (let e = 0; e < 4; e++) {
			const [r0, y0] = c[e],
				[r1, y1] = c[(e + 1) % 4];
			for (let i = 0; i < S; i++) {
				const f = i / S;
				pts.push(P(th, r0 + (r1 - r0) * f, y0 + (y1 - y0) * f));
			}
		}
		return pts;
	};
	// 둥근 링(와셔) 프로필: 바깥반지름 R, 구멍 r, 두께 h, 바깥/안쪽 모서리 라운드 cr/ci
	// 4변(바깥벽/윗면/안쪽벽/아랫면)을 모서리 곡선의 중간에서 나눠 각 S점으로 균일 재배치
	// R에 함수를 넘기면 각도별 바깥반지름 (예: 둥근 사각형 → 모서리 둥근 큐브)
	const ringProf = (R, r, h, cr, ci) => {
		if (typeof R === "function") {
			const cache = new Map();
			return (th) => {
				const Rt = R(th);
				if (!cache.has(Rt)) cache.set(Rt, ringProf(Rt, r, h, cr, ci));
				return cache.get(Rt)(th);
			};
		}
		const y1 = h / 2,
			y0 = -h / 2;
		const arc = (cx, cy, rad, a0, a1) => {
			const out = [];
			for (let i = 0; i <= 12; i++) {
				const a = a0 + ((a1 - a0) * i) / 12;
				out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
			}
			return out;
		};
		const D = Math.PI / 180;
		const segs = [
			[...arc(R - cr, y0 + cr, cr, -45 * D, 0), ...arc(R - cr, y1 - cr, cr, 0, 45 * D)], // 바깥벽
			[...arc(R - cr, y1 - cr, cr, 45 * D, 90 * D), ...arc(r + ci, y1 - ci, ci, 90 * D, 135 * D)], // 윗면
			[...arc(r + ci, y1 - ci, ci, 135 * D, 180 * D), ...arc(r + ci, y0 + ci, ci, 180 * D, 225 * D)], // 안쪽벽
			[...arc(r + ci, y0 + ci, ci, 225 * D, 270 * D), ...arc(R - cr, y0 + cr, cr, 270 * D, 315 * D)], // 아랫면
		];
		const prof = [];
		segs.forEach((pl) => {
			const len = [0];
			for (let i = 1; i < pl.length; i++) len.push(len[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]));
			const total = len[len.length - 1];
			for (let i = 0, j = 1; i < S; i++) {
				const d = (total * i) / S;
				while (j < pl.length - 1 && len[j] < d) j++;
				const f = (d - len[j - 1]) / (len[j] - len[j - 1] || 1);
				prof.push([pl[j - 1][0] + (pl[j][0] - pl[j - 1][0]) * f, pl[j - 1][1] + (pl[j][1] - pl[j - 1][1]) * f]);
			}
		});
		return (th) => prof.map(([rr, y]) => P(th, rr, y));
	};
	function buildShape(prof, matrix, smooth) {
		const pos = [];
		for (let i = 0; i < N; i++) {
			const a = prof((i / N) * Math.PI * 2),
				b = prof(((i + 1) / N) * Math.PI * 2);
			for (let k = 0; k < K; k++) {
				const k2 = (k + 1) % K;
				pos.push(...a[k], ...a[k2], ...b[k2], ...a[k], ...b[k2], ...b[k]);
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		if (matrix) g.applyMatrix4(matrix);
		g.computeVertexNormals();
		if (smooth) {
			// 곡면 도형은 부드러운 노멀: 같은 위치 정점끼리 면 노멀을 평균
			const p = g.attributes.position.array,
				n = g.attributes.normal.array;
			const acc = new Map();
			const key = (i) => `${p[i].toFixed(4)},${p[i + 1].toFixed(4)},${p[i + 2].toFixed(4)}`;
			for (let i = 0; i < p.length; i += 3) {
				const k = key(i),
					a = acc.get(k) || [0, 0, 0];
				a[0] += n[i];
				a[1] += n[i + 1];
				a[2] += n[i + 2];
				acc.set(k, a);
			}
			for (let i = 0; i < p.length; i += 3) {
				const a = acc.get(key(i)),
					l = Math.hypot(a[0], a[1], a[2]) || 1;
				n[i] = a[0] / l;
				n[i + 1] = a[1] / l;
				n[i + 2] = a[2] / l;
			}
		}
		return { p: g.attributes.position.array, n: g.attributes.normal.array };
	}
	const SQ = Math.PI / 4; // 사각형 꼭짓점 45°
	const HX = Math.PI / 2; // 육각형 꼭짓점 90° (눕히면 위아래 뾰족)
	// [TEST] 사각 → 육각 → 팔각 → 십각 너트 (같은 두께·구멍, 꼭짓점이 3° 샘플 간격에 맞도록 시작 각도 지정)
	const nut = (n, corner) =>
		buildShape(lineProf({ outB: polyR(n, 2.1, corner), outT: polyR(n, 2.1, corner), inT: () => 1.18, inB: () => 1.18, y0: -0.45, y1: 0.45 }), new THREE.Matrix4().makeRotationX(Math.PI / 2));
	const SHAPES = [
		nut(4, SQ), // 0: 사각
		nut(6, HX), // 1: 육각
		nut(8, 0), // 2: 팔각
		nut(10, HX), // 3: 십각
	];
	const SIDES = [4, 6, 8, 10];
	while (CFG.clear.length < SHAPES.length) CFG.clear.push(1);
	// 변형 도중에 거쳐 가는 조각 상태 (멈춰 있을 때는 안 보임)
	const SHATTER = buildBlades(CFG.shatter);

	/* 조각 상태: 둘레 N조각을 count개 묶음으로 나눠 묶음마다 모서리 둥근 직육면체 하나를 만듦
	   → 다른 도형과 정점 수·순서가 같아서 각 부분이 가까운 조각으로 갈라졌다가 모임
	   묶음의 첫/끝 단면은 한 점으로 모아 뚜껑(평평한 끝면)을 닫고, 조각 사이 이음은 면적 0이라 안 보임 */
	function buildBlades(B) {
		const COUNT = B.count,
			LEN = B.length,
			HW = B.width / 2,
			HT = B.thick / 2;
		// 단면(둥근 사각형) 둘레를 K점으로 균일 분할
		function rectProfile(hw, ht, r) {
			r = Math.max(0.005, Math.min(r, hw, ht));
			const pl = [];
			const corner = (cy, cz, a0) => {
				for (let i = 0; i <= 8; i++) {
					const a = a0 + (Math.PI / 2) * (i / 8);
					pl.push([cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
				}
			};
			corner(hw - r, ht - r, 0);
			corner(-hw + r, ht - r, Math.PI / 2);
			corner(-hw + r, -ht + r, Math.PI);
			corner(hw - r, -ht + r, (Math.PI * 3) / 2);
			pl.push(pl[0]);
			const len = [0];
			for (let i = 1; i < pl.length; i++) len.push(len[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]));
			const total = len[len.length - 1];
			const out = [];
			for (let i = 0, j = 1; i < K; i++) {
				const d = (total * i) / K;
				while (j < pl.length - 1 && len[j] < d) j++;
				const f = (d - len[j - 1]) / (len[j] - len[j - 1] || 1);
				out.push([pl[j - 1][0] + (pl[j][0] - pl[j - 1][0]) * f, pl[j - 1][1] + (pl[j][1] - pl[j - 1][1]) * f]);
			}
			return out;
		}
		const tw = (B.twist * Math.PI) / 180,
			sk = (B.skew * Math.PI) / 180;
		function makeTable(reverse) {
			const table = new Array(N);
			for (let b = 0; b < COUNT; b++) {
				const s0 = Math.round((b * N) / COUNT),
					s1 = Math.round(((b + 1) * N) / COUNT),
					m = s1 - s0;
				// 링/너트와 같은 방향에 오도록 (그 도형들은 X축 90° 회전 → 각도 부호 반대)
				const phi = -(((s0 + s1) / 2 / N) * Math.PI * 2);
				for (let j = 0; j < m; j++) {
					const cap = j === 0 || j === m - 1;
					// 길이 방향 위치: 양 끝에 촘촘하게 (끝 모서리 라운드용)
					const s = cap ? (j === 0 ? 0 : LEN) : LEN * (0.5 - 0.5 * Math.cos((Math.PI * (j - 1)) / (m - 3)));
					const d = Math.min(s, LEN - s);
					const inset = d < B.round ? B.round - Math.sqrt(Math.max(0, B.round * B.round - (B.round - d) * (B.round - d))) : 0;
					let prof = cap ? new Array(K).fill([0, 0]) : rectProfile(HW - inset, HT - inset, B.round - inset * 0.6);
					if (reverse) prof = prof.slice().reverse();
					table[s0 + j] = prof.map(([y, z]) => {
						let x = B.inner + s;
						// 1) 길이축 기준 비틀기 (프로펠러처럼)
						const y1 = y * Math.cos(tw) - z * Math.sin(tw),
							z1 = y * Math.sin(tw) + z * Math.cos(tw);
						// 2) 안쪽 끝 기준으로 옆으로 기울이기 (중심에서 살짝 비껴 나가게)
						const x2 = B.inner + (x - B.inner) * Math.cos(sk) - y1 * Math.sin(sk),
							y2 = (x - B.inner) * Math.sin(sk) + y1 * Math.cos(sk);
						// 3) 원형 배치
						return [x2 * Math.cos(phi) - y2 * Math.sin(phi), x2 * Math.sin(phi) + y2 * Math.cos(phi), z1];
					});
				}
			}
			return table;
		}
		const build = (reverse) => {
			const table = makeTable(reverse);
			return buildShape((th) => table[Math.round((th / (Math.PI * 2)) * N) % N], null, true);
		};
		// 면이 바깥을 향하도록 부피 부호로 감기 방향 확인
		let shape = build(false);
		let vol = 0;
		const p = shape.p;
		for (let i = 0; i < p.length; i += 9) {
			vol +=
				p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7]) -
				p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6]) +
				p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6]);
		}
		if (vol < 0) shape = build(true);
		return shape;
	}

	const geoA = new THREE.BufferGeometry();
	const aPos = new THREE.BufferAttribute(new Float32Array(SHAPES[0].p), 3);
	const aNrm = new THREE.BufferAttribute(new Float32Array(SHAPES[0].n), 3);
	const bPos = new THREE.BufferAttribute(new Float32Array(SHAPES[1].p), 3);
	const bNrm = new THREE.BufferAttribute(new Float32Array(SHAPES[1].n), 3);
	geoA.setAttribute("position", aPos);
	geoA.setAttribute("normal", aNrm);
	geoA.setAttribute("aPosB", bPos);
	geoA.setAttribute("aNormB", bNrm);
	geoA.setAttribute("aPosX", new THREE.BufferAttribute(new Float32Array(SHATTER.p), 3));
	geoA.setAttribute("aNormX", new THREE.BufferAttribute(new Float32Array(SHATTER.n), 3));
	geoA.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
	function setPair(from, to) {
		aPos.array.set(SHAPES[from].p);
		aNrm.array.set(SHAPES[from].n);
		bPos.array.set(SHAPES[to].p);
		bNrm.array.set(SHAPES[to].n);
		aPos.needsUpdate = aNrm.needsUpdate = bPos.needsUpdate = bNrm.needsUpdate = true;
	}

	const prism = new THREE.Mesh(geoA);
	prism.frustumCulled = false;
	scene.add(prism);

	const morph = { value: 0 };
	const shatter = { value: 0 }; // 조각 상태로 끌려가는 정도 (변형 중간에 최대)
	const clear = { value: 0 };
	const CLEAR = CFG.clear; // 도형별 투명도 (너트, 링, 큐브)

	const glassVS = `
    attribute vec3 aPosB; attribute vec3 aNormB; attribute vec3 aPosX; attribute vec3 aNormX;
    uniform float uMorph, uShatter;
    varying vec3 vN; varying vec3 vEye;
    void main(){
      // A → B 보간 위에, 변형 중간일수록 조각 상태(X) 쪽으로 끌려감
      vec3 p = mix(mix(position, aPosB, uMorph), aPosX, uShatter);
      vec3 n = mix(mix(normal, aNormB, uMorph), aNormX, uShatter) + 1e-5;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vN = normalize(mat3(modelMatrix) * n);
      vEye = normalize(wp.xyz - cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
	const glassFS = `
    uniform sampler2D uTex; uniform vec2 uRes;
    uniform float uPower, uChroma, uSat, uShine, uFres, uSpec, uClear, uIri, uEdge, uBlur, uIriFrom, uIriDeep, uRim, uShade, uRefl, uFringe, uLRefl, uEnv, uLine;
    uniform vec3 uLight, uTint;
    varying vec3 vN; varying vec3 vEye;
    vec3 sat(vec3 c, float a){ return mix(vec3(dot(c, vec3(.2125,.7154,.0721))), c, a); }
    // 반사 방향(y)에 따른 어두운 띠 두 줄 (위쪽 굵게, 아래쪽 약하게)
    float darkBand(float y){
      return smoothstep(-0.05, 0.1, y) * (1.0 - smoothstep(0.3, 0.45, y))
           + 0.7 * smoothstep(-0.75, -0.6, y) * (1.0 - smoothstep(-0.5, -0.4, y));
    }
    // 반사 방향(y)에 따른 밝은 띠 (위쪽 소프트박스 + 아래쪽 반사판)
    float lightBand(float y){
      return smoothstep(0.35, 0.55, y) * (1.0 - smoothstep(0.8, 0.95, y))
           + 0.5 * smoothstep(-0.3, -0.15, y) * (1.0 - smoothstep(-0.05, 0.08, y));
    }
    // 프리즘 팔레트 (레퍼런스 픽셀에서 추출): 크림 → 노랑 → 호박 → 진한 빨강 → 보라 → 파랑 → 시안 → 핑크 → 크림
    vec3 prism(float t){
      t = fract(t);
      vec3 c0 = vec3(0.984, 0.906, 0.749), c1 = vec3(0.855, 0.761, 0.031), c2 = vec3(0.710, 0.471, 0.039),
           c3 = vec3(0.290, 0.020, 0.055), c4 = vec3(0.208, 0.000, 0.498), c5 = vec3(0.008, 0.255, 0.761),
           c6 = vec3(0.004, 0.702, 0.831), c7 = vec3(0.976, 0.616, 0.800);
      if (t < 0.12) return mix(c0, c1, t / 0.12);
      if (t < 0.25) return mix(c1, c2, (t - 0.12) / 0.13);
      if (t < 0.37) return mix(c2, c3, (t - 0.25) / 0.12);
      if (t < 0.50) return mix(c3, c4, (t - 0.37) / 0.13);
      if (t < 0.62) return mix(c4, c5, (t - 0.50) / 0.12);
      if (t < 0.72) return mix(c5, c6, (t - 0.62) / 0.10);
      if (t < 0.85) return mix(c6, c7, (t - 0.72) / 0.13);
      return mix(c7, c0, (t - 0.85) / 0.15);
    }
    // [TEST] 스튜디오 환경: 위 소프트박스 + 왼쪽·오른쪽 세로 조명 + 은은한 돔 (카메라 쪽엔 조명 없음 → 정면은 어두움)
    float studio(vec3 r){
      float top = smoothstep(0.6, 0.78, r.y) * (1.0 - smoothstep(0.45, 0.75, abs(r.x)));
      float left = (1.0 - smoothstep(-0.88, -0.72, r.x)) * (1.0 - smoothstep(0.35, 0.65, abs(r.y - 0.05)));
      float right = smoothstep(0.74, 0.9, r.x) * (1.0 - smoothstep(0.15, 0.4, abs(r.y + 0.15)));
      float dome = smoothstep(-0.3, 1.0, r.y) * 0.07;
      return top * 1.1 + left * 1.1 + right * 0.7 + dome;
    }
    vec3 samp(vec3 n, float ior, float off){
      vec3 r = refract(vEye, n, 1.0 / ior);
      return texture2D(uTex, gl_FragCoord.xy / uRes + r.xy * off * (1.0 - 0.65 * uClear)).rgb;
    }
    void main(){
      vec3 n = normalize(vN);
      vec3 col = vec3(0.0);
      const int L = SAMPLES;
      for (int i = 0; i < L; i++) {
        float s = float(i) / float(L) * uBlur;
        float R = samp(n, 1.15, (uPower + s)       * uChroma).r;
        vec3 ty = samp(n, 1.16, (uPower + s * 1.5) * uChroma); float Y = (ty.r*2. + ty.g*2. - ty.b) / 6.;
        float G = samp(n, 1.18, (uPower + s * 2.0) * uChroma).g;
        vec3 tc = samp(n, 1.22, (uPower + s * 2.5) * uChroma); float C = (tc.g*2. + tc.b*2. - tc.r) / 6.;
        float B = samp(n, 1.22, (uPower + s * 3.0) * uChroma).b;
        vec3 tp = samp(n, 1.22, (uPower + s * 1.0) * uChroma); float P = (tp.b*2. + tp.r*2. - tp.g) / 6.;
        col.r += R + (2.*P + 2.*Y - C) / 3.;
        col.g += G + (2.*Y + 2.*C - P) / 3.;
        col.b += B + (2.*C + 2.*P - Y) / 3.;
      }
      col = sat(col / (float(L) * 1.5), uSat); // 6파장 합이 원래 밝기의 1.5배라 정규화
      // 투명도: 굴절 안 된 배경을 섞어 더 맑게
      col = mix(col, texture2D(uTex, gl_FragCoord.xy / uRes).rgb, uClear * 0.35);
      col *= uTint; // 유리 색
      // 어두운 반사 띠: 주변 어두운 환경이 곡면에 비침. 채널별로 살짝 어긋나게 해서 띠 경계에 호박/파랑 색 갈라짐
      vec3 rr = reflect(vEye, n);
      float yy = rr.y + rr.x * 0.35;
      vec3 dk = vec3(darkBand(yy + uFringe), darkBand(yy), darkBand(yy - uFringe));
      col *= 1.0 - uRefl * (0.55 + 0.45 * (1.0 - abs(dot(vEye, n)))) * dk;
      // 밝은 반사 띠: 조명(소프트박스)이 곡면에 비침 → 어두운 배경에서 입체감
      vec3 lt = vec3(lightBand(yy + uFringe), lightBand(yy), lightBand(yy - uFringe));
      col += uLRefl * (0.35 + 0.65 * (1.0 - abs(dot(vEye, n)))) * lt;
      // [TEST] 환경 반사 (프레넬: 정면 약하게, 비스듬할수록 강하게) — 채널별로 살짝 어긋나 모서리에 옅은 색 갈라짐
      if (uEnv > 0.0) {
        float F = 0.1 + 0.9 * pow(1.0 - abs(dot(vEye, n)), 3.0);
        vec3 env = vec3(studio(rr + vec3(uFringe, 0.0, 0.0)), studio(rr), studio(rr - vec3(uFringe, 0.0, 0.0)));
        col += env * F * uEnv;
      }
      // [TEST] 모서리·옆면 하이라이트: 비스듬히 기운 면(테두리·구멍 안쪽 벽·옆면)일수록 밝게, 정면은 어둡게 유지
      //        + 면과 면이 만나는 선(fwidth로 검출)을 한 번 더 밝게 → 레퍼런스의 가는 흰 선
      if (uLine > 0.0) {
        float g = smoothstep(0.28, 0.85, 1.0 - abs(dot(vEye, n)));
        float eLine = smoothstep(0.05, 0.3, length(fwidth(n)));
        col += (g * g * g * (0.25 + 0.6 * min(studio(rr), 1.0)) * 1.3 + eLine * 1.1) * uLine;
      }
      // 모서리(비스듬히 보이는 곡면): 무지개 분광 + 살짝 어두운 테두리 → 밝은 배경에서도 유리 윤곽이 보임
      float edge = 1.0 - abs(dot(vEye, n));
      float band = smoothstep(uIriFrom, uIriFrom + 0.35, edge) * (1.0 - smoothstep(0.93, 1.0, edge) * 0.5);
      // 프리즘 스펙트럼: 면 기울기 + 화면 위치로 색상이 흐름. uIriDeep이 클수록 진한 빨강/남색까지 내려감
      float hue = edge * 1.4 + dot(n, vec3(0.45, 0.3, 0.2)) + (gl_FragCoord.x - gl_FragCoord.y * 0.5) / uRes.x * 0.5;
      vec3 spectrum = prism(hue);
      col = mix(col, mix(col * (0.4 + spectrum), spectrum, uIriDeep), band * uIri);
      col *= 1.0 - uEdge * smoothstep(0.55, 0.95, edge);
      // 몸통 음영: 아래·오른쪽을 향한 면을 살짝 어둡게 → 흰 배경에서도 입체감
      col *= 1.0 - uShade * smoothstep(-0.3, 1.0, dot(n, normalize(vec3(0.35, -0.8, 0.3))));
      col = mix(col, vec3(1.0), smoothstep(0.9, 1.0, edge) * uRim); // 실루엣 바로 안쪽 흰 테두리
      vec3 Lv = normalize(-uLight);
      float spec = pow(max(dot(n, normalize(Lv - vEye)), 0.0), uShine);
      float fres = pow(1.0 - abs(dot(vEye, n)), uFres);
      // 밝은 배경에서는 흰 광택 더하기를 줄여 유리 몸통이 배경색과 같게 (어두운 배경은 그대로)
      float bgL = dot(texture2D(uTex, gl_FragCoord.xy / uRes).rgb, vec3(0.3333));
      col += (spec * 0.9 + fres * 0.5 * (1.0 - 0.6 * uClear)) * uSpec * mix(1.0, 0.15, bgL);
      gl_FragColor = vec4(col, 1.0);
    }`;
	const makeGlass = (side, spec) =>
		new THREE.ShaderMaterial({
			uniforms: {
				uTex: { value: null },
				uRes: res,
				uMorph: morph,
				uShatter: shatter,
				uClear: clear,
				uPower: { value: CFG.refraction },
				uChroma: { value: CFG.chroma },
				uSat: { value: CFG.saturation },
				uShine: { value: 42 },
				uFres: { value: 7 },
				uSpec: { value: spec * CFG.shine },
				uLight: { value: new THREE.Vector3(-1, -1.2, -1) },
				uTint: { value: new THREE.Color(CFG.glassColor) },
				uIri: { value: CFG.edgeRainbow },
				uEdge: { value: CFG.edgeDark },
				uBlur: { value: CFG.blur },
				uIriFrom: { value: CFG.rainbowFrom },
				uIriDeep: { value: CFG.rainbowDeep },
				uRim: { value: CFG.rimWhite },
				uShade: { value: CFG.bodyShade },
				uRefl: { value: CFG.darkReflect },
				uFringe: { value: CFG.reflectFringe },
				uLRefl: { value: CFG.lightReflect },
				uEnv: { value: CFG.envReflect },
				uLine: { value: CFG.edgeLine },
			},
			defines: { SAMPLES },
			extensions: { derivatives: true }, // [TEST] fwidth로 모서리 선 검출
			vertexShader: glassVS,
			fragmentShader: glassFS,
			side,
		});
	const backMat = makeGlass(THREE.BackSide, CFG.fx.backBright !== undefined ? CFG.fx.backBright : 0.35); // [TEST] 뒷면 밝기 (높을수록 속이 비쳐 보여 유리 같음)
	const frontMat = makeGlass(THREE.FrontSide, 1.0);

	const rtBg = new THREE.WebGLRenderTarget(1, 1);
	const rtBack = new THREE.WebGLRenderTarget(1, 1);

	// [TEST] 유리 칸막이: 최종 장면을 한 번 더 그려서 세로 골(원통 렌즈) 모양으로 굴절
	const FLUTE = CFG.fx.flute > 0 && CFG.fx.fluteWidth > 0;
	const rtFinal = new THREE.WebGLRenderTarget(1, 1);
	const rtGlow = new THREE.WebGLRenderTarget(1, 1); // 도형만 투명 배경에 (도형 레이어 + 빛 번짐 재료)
	const rtProj = new THREE.WebGLRenderTarget(1, 1); // PROJECT 글자만 투명 배경에
	// 레이어 3장(배경+타이틀 / 도형 / PROJECT)을 각각 다른 세기로 골 유리 굴절 후 합성
	//   글자는 fluteText px, 도형은 flute px 만큼 어긋남
	const fluteMat = new THREE.ShaderMaterial({
		uniforms: {
			tBase: { value: rtFinal.texture },
			tGlow: { value: rtGlow.texture },
			tProj: { value: rtProj.texture },
			uRes: res,
			uW: { value: CFG.fx.fluteWidth * DPR },
			uShift: { value: CFG.fx.flute * DPR },
			uShiftT: { value: (CFG.fx.fluteText !== undefined ? CFG.fx.fluteText : CFG.fx.flute) * DPR },
			uBloom: { value: CFG.bloom },
			uBloomR: { value: 13 * DPR },
		},
		vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
		fragmentShader: `
      uniform sampler2D tBase, tGlow, tProj; uniform vec2 uRes; uniform float uW, uShift, uShiftT, uBloom, uBloomR;
      // 골 유리 굴절: 골마다 원통 렌즈처럼 밀어 냄 → 경계에서 계단처럼 어긋남 (골 양끝에서 최대 sh px), 대각 3샘플로 살짝 뿌옇게
      vec4 flute(sampler2D t, vec2 p, vec2 b, float sh){
        vec2 uv = (p + b * 2.0 * sh) / uRes;
        vec2 px = vec2(1.0, 1.0) / uRes * 1.1;
        return (texture2D(t, uv - px) + texture2D(t, uv) + texture2D(t, uv + px)) / 3.0;
      }
      void main(){
        vec2 p = gl_FragCoord.xy;
        // 세로 골 + 가로 골 (격자 유리): 골 안 위치 0~1 → 가운데 0 · 양끝 ±0.5
        vec2 b = vec2(fract(p.x / uW), fract(p.y / uW)) - 0.5;
        vec4 base = flute(tBase, p, b, uShiftT); // 배경 + 타이틀
        vec4 sh = flute(tGlow, p, b, uShift);    // 도형 (프리멀티플라이)
        vec4 pj = flute(tProj, p, b, uShiftT);   // PROJECT (프리멀티플라이)
        vec3 c = base.rgb * (1.0 - sh.a) + sh.rgb;
        c = c * (1.0 - pj.a) + pj.rgb;
        // 블룸: 도형의 밝은 부분만 원형으로 모아 은은하게 번지게 (글자는 번지지 않음)
        if (uBloom > 0.0) {
          vec2 uv = (p + b * 2.0 * uShift) / uRes;
          vec3 bl = vec3(0.0);
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 0.5236;
            for (int j = 1; j <= 2; j++) {
              vec2 o = vec2(cos(a), sin(a)) * uBloomR * float(j) / uRes;
              bl += max(texture2D(tGlow, uv + o).rgb - 0.55, 0.0);
            }
          }
          c += bl * uBloom / 24.0;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
		depthTest: false,
		depthWrite: false,
	});
	const fluteScene = new THREE.Scene();
	fluteScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fluteMat));
	backMat.uniforms.uTex.value = rtBg.texture;
	frontMat.uniforms.uTex.value = rtBack.texture;

	// 모바일에서 메모리가 부족하면 브라우저가 WebGL을 회수했다가 돌려줌 → 돌아오면 타이틀 텍스처 다시 올림
	canvas.addEventListener("webglcontextrestored", () => {
		textTex.needsUpdate = true;
		projTex.needsUpdate = true;
	});

	/* ---------- 리사이즈 / 입력 ---------- */
	let W = 0,
		H = 0;
	function resize() {
		W = wrap.clientWidth || 1;
		H = wrap.clientHeight || 1;
		renderer.setSize(W, H, false);
		rtBg.setSize(W * DPR, H * DPR);
		rtBack.setSize(W * DPR, H * DPR);
		rtFinal.setSize(W * DPR, H * DPR);
		rtGlow.setSize(W * DPR, H * DPR);
		rtProj.setSize(W * DPR, H * DPR);
		res.value.set(W * DPR, H * DPR);
		redrawTitle(W, H);
		camera.aspect = W / H;
		camera.position.z = W / H < 0.9 ? (10 / (W / H)) * 0.8 : 10;
		camera.updateProjectionMatrix();
	}
	new ResizeObserver(resize).observe(wrap);
	resize();

	const mouse = { x: 0, y: 0 };
	// 배경 그라데이션 중심: 처음엔 오른쪽 위, 마우스가 움직이면 따라감 (wrap 기준 px)
	const glowT = { x: W * 0.95, y: 0 },
		glowP = { x: W * 0.95, y: 0 };
	window.addEventListener("pointermove", (e) => {
		const r = wrap.getBoundingClientRect();
		mouse.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
		mouse.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
		glowT.x = e.clientX - r.left;
		glowT.y = e.clientY - r.top;
	});

	/* ---------- 모핑: 도형 클릭 시 다음 도형으로 (너트 → 링 → 큐브 → 반복) ---------- */
	const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
	const START = Math.max(0, Math.min(SHAPES.length - 1, CFG.startShape | 0));
	const stage = { from: START, to: (START + 1) % SHAPES.length, start: -1 }; // start < 0 이면 대기 중
	function stageAt(t) {
		if (stage.start < 0) return { from: stage.from, to: stage.to, u: 0 };
		const c = (t - stage.start) / MORPH;
		if (c >= 1) {
			// 변형 완료 → 도착한 도형을 기준으로 다음 쌍 준비
			stage.from = stage.to;
			stage.to = (stage.to + 1) % SHAPES.length;
			stage.start = -1;
			stage.end = t; // [TEST] 자동 변형 대기 시작 시점
			return { from: stage.from, to: stage.to, u: 0 };
		}
		return { from: stage.from, to: stage.to, u: ease(c) };
	}

	// 도형 히트 테스트 (앞/뒷면 모두)
	const ray = new THREE.Raycaster();
	const hitMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
	const ndc = new THREE.Vector2();
	function hitShape(e) {
		const r = wrap.getBoundingClientRect();
		if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return false;
		ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
		ray.setFromCamera(ndc, camera);
		const keep = prism.material;
		prism.material = hitMat;
		const hit = ray.intersectObject(prism).length > 0;
		prism.material = keep;
		return hit;
	}
	// [TEST] 프로젝트 섹션이 도형 위로 올라오므로 그 위에서는 도형 드래그·클릭·커서 반응 안 함
	const isUI = (e) => e.target.closest && e.target.closest("a, button, input, label, select, textarea, #project_site, .c_scrollbar");
	// 커서 상태 알림: 전역 커서(cursor.js)는 <html data-cursor>를 읽고, 없을 땐 기본 커서로 대체
	const NATIVE = { drag: "grab", grabbing: "grabbing" };
	function setCursor(s) {
		const root = document.documentElement;
		if (s) root.dataset.cursor = s;
		else delete root.dataset.cursor;
		wrap.style.cursor = NATIVE[s] || "";
	}

	/* ---------- 드래그로 자유 회전 (360°, 놓으면 관성으로 계속 돌다가 멈춤) ---------- */
	const qUser = new THREE.Quaternion(),
		qStep = new THREE.Quaternion();
	const AX = new THREE.Vector3(1, 0, 0),
		AY = new THREE.Vector3(0, 1, 0);
	const drag = { on: false, moved: false, x: 0, y: 0, vx: 0, vy: 0 };
	function spinBy(dx, dy) {
		// 화면 기준 축으로 회전 (좌우 드래그 = 세로축, 상하 드래그 = 가로축)
		qStep.setFromAxisAngle(AY, dx);
		qUser.premultiply(qStep);
		qStep.setFromAxisAngle(AX, dy);
		qUser.premultiply(qStep);
	}
	window.addEventListener("pointerdown", (e) => {
		drag.moved = false; // 누를 때마다 초기화 (이전 드래그 흔적이 다음 클릭을 막지 않게)
		if (isUI(e) || !hitShape(e)) return;
		e.preventDefault(); // 드래그 중 텍스트 선택 방지
		Object.assign(drag, { on: true, moved: false, x: e.clientX, y: e.clientY, vx: 0, vy: 0 });
		setCursor("grabbing");
	});
	window.addEventListener("pointermove", (e) => {
		if (drag.on) {
			const dx = e.clientX - drag.x,
				dy = e.clientY - drag.y;
			drag.x = e.clientX;
			drag.y = e.clientY;
			if (Math.hypot(dx, dy) > 2) drag.moved = true; // 조금이라도 끌면 클릭(변형)으로 치지 않음
			const k = CFG.dragSpeed;
			spinBy(dx * k, dy * k);
			drag.vx = dx * k;
			drag.vy = dy * k;
			return;
		}
		setCursor(!isUI(e) && hitShape(e) ? "drag" : ""); // 도형 위에서는 DRAG 커서
	});
	const endDrag = () => {
		if (!drag.on) return;
		drag.on = false;
		setCursor("drag");
	};
	window.addEventListener("pointerup", endDrag);
	window.addEventListener("pointercancel", endDrag);
	// 터치로 도형을 돌릴 때 페이지 스크롤 막기
	window.addEventListener("touchmove", (e) => drag.on && e.preventDefault(), { passive: false });

	// 클릭(드래그 아님) 시 다음 도형으로 변형
	window.addEventListener("click", (e) => {
		if (drag.moved) return (drag.moved = false); // 방금 드래그했으면 클릭 무시
		if (isUI(e)) return;
		if (stage.start >= 0 || !hitShape(e)) return; // 변형 중이거나 도형 밖이면 무시
		stage.start = clock.getElapsedTime();
	});

	/* ---------- 루프 ---------- */
	const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const clock = new THREE.Clock();
	const tilt = { x: 0, z: 0 };
	const qA = new THREE.Quaternion(),
		qB = new THREE.Quaternion();
	const eA = new THREE.Euler(),
		eB = new THREE.Euler();
	let curFrom = -1; // 첫 프레임에 시작 도형 쌍을 올림
	const kick = { from: -1, acc: 0, amt: 0, dir: 1, tiltDir: 1 }; // [TEST] 변형할 때 도는 각도
	const AZ = new THREE.Vector3(0, 0, 1); // 너트 면의 축 (도형을 X축으로 90° 세워 만들었으므로 로컬 Z가 정면 방향)

	/* ---------- [TEST] 추가 인터랙션 ---------- */
	const FX = CFG.fx;
	const FXON = !reduce;
	// 글자 이징: 기존 PROJECT 타이틀과 동일 (lusion = cubic-bezier(.35, 0, 0, 1)), 글자당 0.67초 · 1/30초 간격
	let EASE_L = "power4.out";
	if (window.gsap && window.CustomEase) {
		gsap.registerPlugin(CustomEase);
		EASE_L = CustomEase.create("lusionTitle", "M0,0 C0.35,0 0,1 1,1");
	}
	const CH_DUR = 1 / 1.5,
		CH_STAG = 1 / 30;
	const markDirty = () => (txtDirty = true);
	// 1) 인트로: 타이틀 글자별로 아래에서 회전하며 올라옴 + 도형 스케일/회전 등장
	const intro = { s: 1, spin: 0 };
	let introStart = null,
		frame = 0;
	if (FX.intro && FXON && window.gsap) {
		intro.s = 0;
		intro.spin = -2.4;
		// 첫 프레임(셰이더 컴파일로 멈칫함)이 지난 뒤 시작 → 느린 기기에서도 앞부분이 잘리지 않음
		introStart = () => {
			if (!titleOut) gsap.to(titleFlat, { v: 0, duration: CH_DUR, ease: EASE_L, stagger: CH_STAG, delay: 0.2, onUpdate: markDirty });
			gsap.to(intro, { s: 1, spin: 0, duration: 2, ease: "expo.out", delay: 0.05 });
		};
	} else {
		titleFlat.forEach((o) => (o.v = 0));
		drawTitle(W, H);
	}
	// 2) 렌즈: 캔버스 안에 마우스가 있을 때만 켜짐
	const lensP = { x: glowT.x, y: glowT.y };
	let lensOn = false;
	const LENS = FXON && !MOBILE ? FX.lens : 0;
	window.addEventListener("pointermove", (e) => {
		const r = wrap.getBoundingClientRect();
		lensOn = e.pointerType === "mouse" && e.clientY >= r.top && e.clientY <= r.bottom && !isUI(e);
	});
	document.addEventListener("mouseleave", () => (lensOn = false));
	// 3) 클릭 파동 (도형 변형 클릭과 함께 동작)
	let ripStart = -99;
	window.addEventListener("click", (e) => {
		if (!FXON || !FX.ripple || isUI(e)) return;
		const r = wrap.getBoundingClientRect();
		if (e.clientY < r.top || e.clientY > r.bottom) return;
		rip.value.x = (e.clientX - r.left) * DPR;
		rip.value.y = (r.bottom - e.clientY) * DPR;
		ripStart = clock.getElapsedTime();
	});
	// 4) 스크롤: 캔버스는 화면에 고정, 페이지 스크롤 양(화면 높이 단위)과 속도만 읽음
	//    0 = 맨 위, 1 = 프로젝트 섹션이 화면을 덮은 시점, 그 뒤로도 계속 증가
	const scr = { t: 0, p: 0, v: 0, vs: 0, last: window.scrollY };
	// 일정 이상 스크롤하면: 타이틀 글자들이 위로 회전하며 빠지고 → PROJECT 글자들이 아래에서 회전하며 올라옴
	// 다시 올리면 반대로 (PROJECT 아래로 빠짐 → 타이틀이 위에서 내려옴)
	let titleOut = false;
	function setTitleOut(o) {
		if (o === titleOut || !window.gsap) return;
		titleOut = o;
		gsap.killTweensOf(titleFlat);
		gsap.killTweensOf(projChars);
		if (o) {
			gsap.to(titleFlat, { v: 1, duration: CH_DUR, ease: EASE_L, stagger: CH_STAG, onUpdate: markDirty });
			gsap.to(projChars, { v: 0, duration: CH_DUR, ease: EASE_L, stagger: CH_STAG, delay: 0.3, onUpdate: markDirty });
		} else {
			gsap.to(projChars, { v: -1, duration: CH_DUR, ease: EASE_L, stagger: CH_STAG, onUpdate: markDirty });
			gsap.to(titleFlat, { v: 0, duration: CH_DUR, ease: EASE_L, stagger: CH_STAG, delay: 0.2, onUpdate: markDirty });
		}
	}
	// 카드가 올라오면(1.6화면) PROJECT도 등장과 같은 글자 효과로 위로 빠지고, 다시 올리면(1.5화면 미만) 위에서 내려옴
	let projOut = false;
	function setProjOut(o) {
		if (o === projOut || !window.gsap) return;
		projOut = o;
		gsap.killTweensOf(projChars);
		gsap.to(projChars, { v: o ? 1 : 0, duration: CH_DUR, ease: EASE_L, stagger: CH_STAG, onUpdate: markDirty });
	}
	const checkTitle = (t) => {
		if (t > 0.12) setTitleOut(true);
		else if (t < 0.06) {
			projOut = false;
			setTitleOut(false);
		}
		if (titleOut) {
			if (t > 1.6) setProjOut(true);
			else if (t < 1.5) setProjOut(false);
		}
	};
	if (FX.scroll && FXON) {
		document.documentElement.classList.add("has-proj-fx"); // 캔버스가 PROJECT를 그리므로 DOM 제목은 CSS로 숨김
		window.addEventListener(
			"scroll",
			() => {
				const y = window.scrollY;
				scr.t = y / (window.innerHeight || 1);
				checkTitle(scr.t);
				scr.v = Math.min(1, scr.v + Math.abs(y - scr.last) / 400);
				scr.last = y;
			},
			{ passive: true },
		);
	}
	// 새로고침 시 스크롤이 내려가 있으면 바로 PROJECT 상태로
	if (FX.scroll && FXON) {
		scr.t = window.scrollY / (window.innerHeight || 1);
		checkTitle(scr.t);
	}
	const par = { x: 0, y: 0 };
	const qFx = new THREE.Quaternion(),
		eFx = new THREE.Euler();

	let visible = true;
	new IntersectionObserver(([en]) => {
		visible = en.isIntersecting;
	}).observe(wrap);

	function tick() {
		requestAnimationFrame(tick);
		if (!visible) return;
		if (introStart && ++frame === 3) introStart(); // [TEST]
		const t = clock.getElapsedTime();
		const m = reduce ? 0 : 1;
		const ge = reduce ? 1 : CFG.bgGlowEase;
		glowP.x += (glowT.x - glowP.x) * ge;
		glowP.y += (glowT.y - glowP.y) * ge;
		glow.value.set(glowP.x * DPR, (H - glowP.y) * DPR);

		// [TEST] 자동 변형: 대기 시간이 지나면 다음 도형으로 (드래그 중·인트로 중엔 기다림, 클릭하면 타이머 초기화)
		if (stage.last === undefined) stage.last = t; // 마지막 변형 시작 시점 (클릭으로 시작해도 갱신)
		if (stage.start >= 0 && stage.start !== stage.last) stage.last = stage.start;
		if (!reduce && FX.autoMorph > 0 && stage.start < 0 && !drag.on && intro.s > 0.99 && t - stage.last >= FX.autoMorph) stage.start = stage.last = t;
		const st = reduce ? { from: START, to: (START + 1) % SHAPES.length, u: 0 } : stageAt(t);
		if (st.from !== curFrom) {
			setPair(st.from, st.to);
			curFrom = st.from;
		}
		const u = st.u;
		morph.value = u;
		// 변형 중간(u = 0.5)에 가장 많이 조각남, 시작·끝에는 0
		shatter.value = Math.sin(u * Math.PI) * CFG.shatter.amount;
		clear.value = CLEAR[st.from] + (CLEAR[st.to] - CLEAR[st.from]) * u;

		tilt.x += (mouse.y * 0.25 - tilt.x) * 0.05;
		tilt.z += (mouse.x * -0.15 - tilt.z) * 0.05;
		const sway = Math.sin(t * 0.4) * m,
			spin = t * 0.25 * m;

		// 도형별 자세
		// 모든 도형 같은 자세 (너트) + 마우스 기울기
		const pose = [0.42 + sway * 0.12 + tilt.x, -0.35 + Math.sin(t * 0.27) * 0.25 * m + mouse.x * 0.45, -0.12 + Math.sin(t * 0.2) * 0.05 * m];
		// [TEST] 변형 모션: 자연스럽게(이징) + 인터랙티브하게
		//   - 변형하는 동안 면 쪽 축으로 한 칸(다음 도형 꼭짓점 간격만큼) 돌며 꼭짓점이 늘어남, 방향은 마우스 좌우 쪽
		//   - 마우스가 멀수록 크게 돌고, 중간에 마우스 위아래 쪽으로 살짝 젖혀졌다 돌아옴 + 숨 쉬듯 커졌다 돌아옴
		if (st.from !== kick.from) {
			kick.acc += kick.amt; // 끝난 변형만큼 누적 (자세가 튀지 않게)
			kick.amt = 0;
			kick.from = st.from;
		}
		if (u > 0 && kick.amt === 0) {
			kick.dir = mouse.x < -0.05 ? -1 : 1;
			kick.amt = ((Math.PI * 2) / SIDES[st.to]) * kick.dir * (1 + Math.abs(mouse.x) * 0.8);
			kick.tiltDir = mouse.y < 0 ? -1 : 1;
		}
		const bump = Math.sin(u * Math.PI);
		eA.set(pose[0] + bump * 0.35 * kick.tiltDir * m, pose[1], pose[2]);
		prism.quaternion.setFromEuler(eA);
		qA.setFromAxisAngle(AZ, (kick.acc + kick.amt * u) * m); // 너트 면(정면) 축으로 회전
		prism.quaternion.multiply(qA);
		fluteMat.uniforms.uBloom.value = CFG.bloom * (1 + bump * 0.8); // 변형 중 빛 번짐 살짝 커짐
		// 드래그 회전 + 관성
		if (!drag.on && (Math.abs(drag.vx) > 1e-5 || Math.abs(drag.vy) > 1e-5)) {
			spinBy(drag.vx, drag.vy);
			drag.vx *= CFG.dragInertia;
			drag.vy *= CFG.dragInertia;
		}
		prism.quaternion.premultiply(qUser);

		// [TEST] 스크롤 진행도·속도 (부드럽게 따라감)
		scr.p += (scr.t - scr.p) * 0.2;
		scr.vs += (scr.v - scr.vs) * 0.08;
		scr.v *= 0.92; // 스크롤 멈추면 속도 감소
		const sp = Math.min(1, scr.p); // 첫 화면 구간(0~1)
		// 스크롤 + 인트로 회전 (프로젝트를 내리는 동안에도 계속 천천히 돎)
		eFx.set(sp * 0.6 + scr.p * 0.25, scr.p * Math.PI * 0.6 + intro.spin + t * FX.spin * m, intro.spin * 0.3); // + 계속 회전
		qFx.setFromEuler(eFx);
		prism.quaternion.premultiply(qFx);
		// 마우스 방향으로 따라 움직임 + 스크롤하면 카메라 쪽으로 다가옴
		par.x += (mouse.x * FX.parallax * m - par.x) * 0.06;
		par.y += (-mouse.y * FX.parallax * 0.6 * m - par.y) * 0.06;
		prism.position.set(0, 0, sp * 1.2); // [TEST] 화면 정가운데 고정 (마우스 따라 움직이지 않음, 스크롤하면 앞으로만 다가옴)
		// 글자 애니메이션 중이면 타이틀·PROJECT 다시 그림
		if (txtDirty) {
			txtDirty = false;
			drawTitle(W, H);
			drawProj(W, H);
		}
		// 스크롤 속도만큼 무지개 번짐
		backMat.uniforms.uChroma.value = frontMat.uniforms.uChroma.value = CFG.chroma + scr.vs * FX.scrollChroma;
		// 렌즈 위치·세기
		lensP.x += (glowT.x - lensP.x) * 0.15;
		lensP.y += (glowT.y - lensP.y) * 0.15;
		lensPos.value.set(lensP.x * DPR, (H - lensP.y) * DPR);
		lensAmt.value += ((lensOn ? LENS : 0) - lensAmt.value) * 0.08;
		// 파동 경과 시간
		rip.value.z = Math.min(99, t - ripStart);

		// 변형 중간에 살짝 커졌다 돌아오는 탄성 (+ 인트로 스케일)
		prism.scale.setScalar((1 + Math.sin(u * Math.PI) * 0.1) * intro.s);

		renderer.setRenderTarget(rtBg);
		renderer.clear();
		renderer.render(bgScene, orthoCam);
		renderer.setRenderTarget(rtBack);
		renderer.clear();
		renderer.render(bgScene, orthoCam);
		prism.material = backMat;
		renderer.render(scene, camera);
		prism.material = frontMat;
		const projOn = projChars.some((c) => Math.abs(c.v) < 1); // 보이는 PROJECT 글자가 있을 때만
		if (FLUTE) {
			// [TEST] 칸막이: 배경+타이틀 / 도형 / PROJECT를 따로 그려서 각자 세기로 골 유리 굴절 후 합성
			renderer.setRenderTarget(rtFinal);
			renderer.clear();
			renderer.render(bgScene, orthoCam);
			renderer.setClearAlpha(0);
			renderer.setRenderTarget(rtGlow);
			renderer.clear();
			renderer.render(scene, camera);
			renderer.setRenderTarget(rtProj);
			renderer.clear();
			if (projOn) renderer.render(projScene, orthoCam);
			renderer.setClearAlpha(1);
			renderer.setRenderTarget(null);
			renderer.clear();
			renderer.render(fluteScene, orthoCam);
		} else {
			renderer.setRenderTarget(null);
			renderer.clear();
			renderer.render(bgScene, orthoCam);
			renderer.render(scene, camera);
			if (projOn) renderer.render(projScene, orthoCam);
		}
	}
	tick();
})();
