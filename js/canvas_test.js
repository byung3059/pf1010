/* canvas_test.js — 첫 화면 유리 도형 비주얼 (.canvas_wrap 안에 WebGL)
   필요: three.js r128, gsap(+CustomEase) — 이 파일보다 먼저 로드
   설정: window.GLASS_CONFIG = { ... } 로 덮어쓰기 (빠진 값은 아래 기본값)

   구성
     1. 설정
     2. 렌더러 · 타이틀/PROJECT 글자 캔버스
     3. 셰이더 (배경 · 글자 오버레이 · 유리 · 격자 유리 칸막이)
     4. 도형 (4 · 6 · 8각 너트, 같은 정점 수로 만들어 바로 보간)
     5. 입력 (드래그 회전)
     6. 인트로 (로딩 카운터 → 공개 → 타이틀 → 헤더)
     7. 스크롤 (타이틀 ↔ PROJECT 전환, 인트로 중 스크롤 잠금)
     8. 매 프레임 (변형 · 자세 · 렌더) */
(async () => {
	/* ───────── 1. 설정 ───────── */
	const CFG = Object.assign(
		{
			// 배경
			bgColor: "#000000", // 배경색
			bgColor2: "rgba(255, 255, 255, 0.06)", // 오른쪽 위 은은한 빛 (비우면 단색)
			bgGlowSize: 0.2, // 빛 크기 (화면 대각선 대비 0~1)
			// 유리
			refraction: 1.4, // 굴절 세기
			chroma: 0.12, // 무지개 번짐
			saturation: 0, // 채도 (0 = 흑백)
			blur: 0.03, // 유리 속 번짐
			clear: 1, // 투명도 0~1
			shine: 0.45, // 하이라이트 세기
			backBright: 0.65, // 뒷면 밝기 (높을수록 속이 비쳐 보임)
			rimWhite: 1, // 실루엣 흰 테두리
			lightReflect: 0.2, // 밝은 반사 띠
			envReflect: 0.95, // 스튜디오 조명 반사 (모서리 흰 선 + 어두운 정면)
			edgeLine: 0.8, // 모서리·옆면 흰 하이라이트
			bloom: 0.9, // 밝은 부분 빛 번짐
			// 격자 유리 칸막이 (화면 전체)
			flute: 8, // 도형이 어긋나는 최대 거리(px)
			fluteText: 4, // 글자가 어긋나는 최대 거리(px)
			fluteWidth: 40, // 칸 하나 폭(px)
			// 타이틀 글자
			textColor: "#ffffff",
			pointColor: "#ffffff", // 마지막 "." 색
			fontFamily: "Paperlogy",
			textWeight: 900,
			textSize: 120, // px — 화면 1024px 초과
			textSizeM: 11.7, // vw — 화면 1024px 이하
			lineHeight: 1,
			responsive: { 480: { textSizeM: 13 } }, // 화면 너비가 키 값 이하일 때 textSizeM 덮어쓰기
			// 움직임
			morph: 1.2, // 변형 시간(초)
			autoMorph: 3, // 자동 변형 간격(초)
			spin: 0.6, // 계속 도는 속도(라디안/초)
			dragSpeed: 0.008, // 드래그 회전 감도
			dragInertia: 0.95, // 놓은 뒤 관성 0~1
			introSpeed: 0.7, // 인트로 속도 (1 = 기본, 낮을수록 느림)
			loadTime: 5.6, // 로딩 숫자 0 → 100% 걸리는 시간(초, introSpeed 1 기준 — 실제로는 ÷ introSpeed)
			mobileDpr: 1.5, // 모바일 최대 해상도 배율 (PC는 2)
			mobileSamples: 8, // 모바일 유리 셰이더 샘플 수 (PC는 16)
		},
		window.GLASS_CONFIG || {},
	);

	const wrap = document.querySelector(".canvas_wrap");
	if (!wrap) return;
	const root = document.documentElement;
	const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const MOBILE = matchMedia("(hover: none) and (pointer: coarse)").matches;
	const SAMPLES = Math.max(1, Math.round(MOBILE ? CFG.mobileSamples : 16));
	const DPR = Math.min(window.devicePixelRatio || 1, MOBILE ? CFG.mobileDpr : 2);
	const HAS_GSAP = !!window.gsap;

	/* ───────── 2. 렌더러 · 글자 캔버스 ───────── */
	if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
	const canvas = document.createElement("canvas");
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
	wrap.appendChild(canvas);
	let renderer;
	try {
		if (!window.THREE) throw new Error("three.js not loaded");
		renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE });
	} catch (e) {
		// WebGL을 못 쓰면 DOM 타이틀을 그대로 보여줌
		canvas.remove();
		(wrap.closest("#project_visual") || document.body).classList.add("is-no-webgl");
		root.classList.remove("intro-pending", "intro-lock");
		return;
	}
	renderer.setPixelRatio(DPR);
	renderer.setClearColor(new THREE.Color(CFG.bgColor), 1);
	renderer.autoClear = false;

	// 타이틀 문구: .slg .tit h2 (<br>로 줄 나눔, .point는 마지막 줄 끝 점) — DOM 글자는 숨기고 캔버스로 그림
	const titleEl = document.querySelector(".slg .tit h2");
	let lines = ["DETAIL", "ORIENTED"],
		pointText = ".";
	if (titleEl) {
		lines = [""];
		pointText = "";
		titleEl.childNodes.forEach((nd) => {
			if (nd.nodeName === "BR") lines.push("");
			else if (nd.classList && nd.classList.contains("point")) pointText = nd.textContent.trim();
			else lines[lines.length - 1] += nd.textContent;
		});
		lines = lines.map((l) => l.trim().toUpperCase());
		if (pointText) lines[lines.length - 1] = lines[lines.length - 1].replace(/\.$/, "");
		titleEl.style.opacity = 0;
	}
	const projEl = document.querySelector("#project_site > h2");
	const projText = projEl ? projEl.textContent.trim().toUpperCase() : "PROJECT";
	try {
		await document.fonts.load(`${CFG.textWeight} 120px "${CFG.fontFamily}"`);
	} catch (e) {}

	// 글자 크기: 1024px 초과 = textSize(px), 이하 = textSizeM(vw, responsive로 덮어쓰기)
	function fontSize(W) {
		if (W > 1024) return CFG.textSize;
		let m = CFG.textSizeM;
		Object.keys(CFG.responsive || {})
			.map(Number)
			.sort((a, b) => b - a)
			.forEach((bp) => {
				if (W <= bp && CFG.responsive[bp].textSizeM) m = CFG.responsive[bp].textSizeM;
			});
		return (W * m) / 100;
	}

	function makeTextCanvas() {
		const c = document.createElement("canvas");
		const tex = new THREE.CanvasTexture(c);
		tex.minFilter = THREE.LinearFilter;
		tex.generateMipmaps = false;
		return { c, ctx: c.getContext("2d"), tex };
	}
	const titleCv = makeTextCanvas(),
		projCv = makeTextCanvas();

	// 글자별 상태 v: -1 = 아래로 숨음 / 0 = 제자리 / 1 = 위로 숨음 (마스크 안에서 이동 + 10° 회전)
	const PLAY_INTRO = HAS_GSAP && !reduce;
	const titleChars = lines.map((ln, i) => Array.from(ln + (i === lines.length - 1 ? pointText : "")).map(() => ({ v: PLAY_INTRO ? -1 : 0 })));
	const titleFlat = titleChars.flat();
	const projChars = Array.from(projText).map(() => ({ v: -1 }));
	let txtDirty = false;
	const markDirty = () => (txtDirty = true);

	function prepCanvas({ c, ctx }, W, H) {
		const nw = Math.max(2, Math.floor(W * DPR)),
			nh = Math.max(2, Math.floor(H * DPR));
		if (c.width !== nw) c.width = nw;
		if (c.height !== nh) c.height = nh;
		ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
		ctx.clearRect(0, 0, W, H);
		const fs = fontSize(W);
		ctx.font = `${CFG.textWeight} ${fs}px ${CFG.fontFamily}, "Arial Black", sans-serif`;
		ctx.textAlign = "left";
		ctx.textBaseline = "alphabetic";
		return { fs, lh: fs * CFG.lineHeight, capH: ctx.measureText("H").actualBoundingBoxAscent || fs * 0.72 };
	}
	// 한 줄을 글자별로 그림: 줄 마스크 안에서 글자가 위·아래로 이동 + 회전
	function drawCharsLine(ctx, str, x, y, states, colorAt, capH, fs, lh, W) {
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, y - capH - fs * 0.2, W, capH + fs * 0.45);
		ctx.clip();
		for (let k = 0; k < str.length; k++) {
			const v = states[k].v;
			if (Math.abs(v) >= 1 || str[k] === " ") continue;
			const cx = x + ctx.measureText(str.slice(0, k)).width;
			const cw = ctx.measureText(str[k]).width;
			ctx.save();
			ctx.translate(cx + cw / 2, y - capH / 2 - v * lh * 1.1);
			ctx.rotate((-v * 10 * Math.PI) / 180);
			ctx.fillStyle = colorAt(k);
			ctx.fillText(str[k], -cw / 2, capH / 2);
			ctx.restore();
		}
		ctx.restore();
	}
	function drawTitle(W, H) {
		const { ctx } = titleCv;
		const { fs, lh, capH } = prepCanvas(titleCv, W, H);
		const n = lines.length;
		const base = H / 2 - (capH + lh * (n - 1)) / 2 + capH; // 첫 줄 기준선 (세로 가운데)
		lines.forEach((ln, i) => {
			const str = ln + (i === n - 1 ? pointText : "");
			const x = W / 2 - ctx.measureText(str).width / 2;
			drawCharsLine(ctx, str, x, base + lh * i, titleChars[i], (k) => (k >= ln.length ? CFG.pointColor : CFG.textColor), capH, fs, lh, W);
		});
		titleCv.tex.needsUpdate = true;
	}
	function drawProj(W, H) {
		const { ctx } = projCv;
		const { fs, lh, capH } = prepCanvas(projCv, W, H);
		const x = W / 2 - ctx.measureText(projText).width / 2;
		drawCharsLine(ctx, projText, x, H / 2 + capH / 2, projChars, () => CFG.textColor, capH, fs, lh, W);
		projCv.tex.needsUpdate = true;
	}

	/* ───────── 3. 셰이더 ───────── */
	const res = { value: new THREE.Vector2(1, 1) };
	const glow = { value: new THREE.Vector2(0, 0) }; // 배경 빛 중심(px, 아래가 0)
	const morph = { value: 0 };
	const flash = { value: 0 }; // 공개 순간 번쩍임
	const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const SCREEN_VS = `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
	const fullScreen = (mat) => {
		const s = new THREE.Scene();
		s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
		return s;
	};

	// 배경: 단색 + 오른쪽 위 원형 빛
	const m = String(CFG.bgColor2).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
	const bgScene = fullScreen(
		new THREE.ShaderMaterial({
			uniforms: {
				uRes: res,
				uGlow: glow,
				uBg1: { value: new THREE.Color(CFG.bgColor) },
				uBg2: { value: m ? new THREE.Color(m[1] / 255, m[2] / 255, m[3] / 255) : new THREE.Color(CFG.bgColor2 || CFG.bgColor) },
				uBg2A: { value: !CFG.bgColor2 ? 0 : m && m[4] !== undefined ? parseFloat(m[4]) : 1 },
				uGlowSize: { value: CFG.bgGlowSize },
			},
			vertexShader: SCREEN_VS,
			fragmentShader: `
      uniform vec2 uRes, uGlow; uniform vec3 uBg1, uBg2; uniform float uBg2A, uGlowSize;
      void main(){
        float d = length(gl_FragCoord.xy - uGlow) / length(uRes);
        gl_FragColor = vec4(mix(uBg1, uBg2, (1.0 - smoothstep(0.0, uGlowSize, d)) * uBg2A), 1.0);
      }`,
			depthTest: false,
			depthWrite: false,
		}),
	);

	// 글자 오버레이: 도형 앞에 그림 (투명 레이어에 쌓아도 알파가 맞게)
	const overlayScene = (tex) =>
		fullScreen(
			new THREE.ShaderMaterial({
				blending: THREE.CustomBlending,
				blendSrc: THREE.SrcAlphaFactor,
				blendDst: THREE.OneMinusSrcAlphaFactor,
				blendSrcAlpha: THREE.OneFactor,
				blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
				uniforms: { tTex: { value: tex }, uRes: res },
				vertexShader: SCREEN_VS,
				fragmentShader: `uniform sampler2D tTex; uniform vec2 uRes; void main(){ gl_FragColor = texture2D(tTex, gl_FragCoord.xy / uRes); }`,
				transparent: true,
				depthTest: false,
				depthWrite: false,
			}),
		);
	const titleScene = overlayScene(titleCv.tex),
		projScene = overlayScene(projCv.tex);

	// 유리: 두 도형(A → B)을 uMorph로 보간, 배경을 파장별로 굴절해 합성 + 반사·하이라이트
	const glassVS = `
    attribute vec3 aPosB; attribute vec3 aNormB;
    uniform float uMorph;
    varying vec3 vN; varying vec3 vEye;
    void main(){
      vec3 p = mix(position, aPosB, uMorph);
      vec3 n = mix(normal, aNormB, uMorph) + 1e-5;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vN = normalize(mat3(modelMatrix) * n);
      vEye = normalize(wp.xyz - cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
	const glassFS = `
    uniform sampler2D uTex; uniform vec2 uRes;
    uniform float uPower, uChroma, uSat, uSpec, uClear, uBlur, uRim, uLRefl, uEnv, uLine, uFlash;
    varying vec3 vN; varying vec3 vEye;
    vec3 sat(vec3 c, float a){ return mix(vec3(dot(c, vec3(.2125,.7154,.0721))), c, a); }
    // 밝은 반사 띠 (위쪽 소프트박스 + 아래쪽 반사판)
    float lightBand(float y){
      return smoothstep(0.35, 0.55, y) * (1.0 - smoothstep(0.8, 0.95, y))
           + 0.5 * smoothstep(-0.3, -0.15, y) * (1.0 - smoothstep(-0.05, 0.08, y));
    }
    // 스튜디오 환경: 위 소프트박스 + 좌우 세로 조명 + 은은한 돔 (정면엔 조명 없음 → 어두운 유리)
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
      vec2 suv = gl_FragCoord.xy / uRes;
      // 6파장 굴절 (R·Y·G·C·B·P) → 프리즘처럼 살짝 갈라짐
      vec3 col = vec3(0.0);
      for (int i = 0; i < SAMPLES; i++) {
        float s = float(i) / float(SAMPLES) * uBlur;
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
      col = sat(col / (float(SAMPLES) * 1.5), uSat);
      col = mix(col, texture2D(uTex, suv).rgb, uClear * 0.35); // 굴절 안 된 배경을 섞어 더 맑게
      float facing = 1.0 - abs(dot(vEye, n)); // 0 = 정면, 1 = 비스듬함
      vec3 rr = reflect(vEye, n);
      col += uLRefl * (0.35 + 0.65 * facing) * lightBand(rr.y + rr.x * 0.35);
      col += studio(rr) * (0.1 + 0.9 * pow(facing, 3.0)) * uEnv; // 환경 반사 (프레넬)
      // 모서리·옆면 하이라이트 + 면이 만나는 선(fwidth)
      float g = smoothstep(0.28, 0.85, facing);
      float eLine = smoothstep(0.05, 0.3, length(fwidth(n)));
      col += (g * g * g * (0.25 + 0.6 * min(studio(rr), 1.0)) * 1.3 + eLine * 1.1) * uLine;
      col = mix(col, vec3(1.0), smoothstep(0.9, 1.0, facing) * uRim); // 실루엣 흰 테두리
      float spec = pow(max(dot(n, normalize(normalize(vec3(1.0, 1.2, 1.0)) - vEye)), 0.0), 42.0);
      float bgL = dot(texture2D(uTex, suv).rgb, vec3(0.3333));
      col += (spec * 0.9 + pow(facing, 7.0) * 0.5 * (1.0 - 0.6 * uClear)) * uSpec * mix(1.0, 0.15, bgL);
      col += uFlash * (0.25 + 0.75 * facing * facing);
      gl_FragColor = vec4(col, 1.0);
    }`;
	const makeGlass = (side, spec) =>
		new THREE.ShaderMaterial({
			uniforms: {
				uTex: { value: null },
				uRes: res,
				uMorph: morph,
				uFlash: flash,
				uPower: { value: CFG.refraction },
				uChroma: { value: CFG.chroma },
				uSat: { value: CFG.saturation },
				uSpec: { value: spec * CFG.shine },
				uClear: { value: CFG.clear },
				uBlur: { value: CFG.blur },
				uRim: { value: CFG.rimWhite },
				uLRefl: { value: CFG.lightReflect },
				uEnv: { value: CFG.envReflect },
				uLine: { value: CFG.edgeLine },
			},
			defines: { SAMPLES },
			extensions: { derivatives: true },
			vertexShader: glassVS,
			fragmentShader: glassFS,
			side,
		});
	const backMat = makeGlass(THREE.BackSide, CFG.backBright);
	const frontMat = makeGlass(THREE.FrontSide, 1);

	// 렌더 타깃: 배경 / 배경+뒷면 / 도형(투명 배경) / 글자(투명 배경)
	const rtBg = new THREE.WebGLRenderTarget(1, 1);
	const rtBack = new THREE.WebGLRenderTarget(1, 1);
	const rtShape = new THREE.WebGLRenderTarget(1, 1);
	const rtText = new THREE.WebGLRenderTarget(1, 1);
	const RTS = [rtBg, rtBack, rtShape, rtText];
	backMat.uniforms.uTex.value = rtBg.texture;
	frontMat.uniforms.uTex.value = rtBack.texture;

	// 격자 유리 칸막이: 세 레이어를 칸마다 원통 렌즈처럼 밀어 내고 합성 (+ 도형 빛 번짐, 인트로 열 스윕)
	const fluteMat = new THREE.ShaderMaterial({
		uniforms: {
			tBase: { value: rtBg.texture },
			tShape: { value: rtShape.texture },
			tText: { value: rtText.texture },
			uRes: res,
			uW: { value: CFG.fluteWidth * DPR },
			uShift: { value: CFG.flute * DPR },
			uShiftT: { value: CFG.fluteText * DPR },
			uBloom: { value: CFG.bloom },
			uBloomR: { value: 13 * DPR },
			uSweep: { value: 999 }, // 가운데 열부터 몇 열까지 칸막이가 끼워졌는지 (999 = 전부)
		},
		vertexShader: SCREEN_VS,
		fragmentShader: `
      uniform sampler2D tBase, tShape, tText; uniform vec2 uRes; uniform float uW, uShift, uShiftT, uBloom, uBloomR, uSweep;
      vec4 flute(sampler2D t, vec2 p, vec2 b, float sh){
        vec2 uv = (p + b * 2.0 * sh) / uRes;
        vec2 px = vec2(1.0) / uRes * 1.1;
        return (texture2D(t, uv - px) + texture2D(t, uv) + texture2D(t, uv + px)) / 3.0;
      }
      void main(){
        vec2 p = gl_FragCoord.xy;
        vec2 b = fract(p / uW) - 0.5; // 칸 안 위치: 가운데 0 · 양끝 ±0.5
        float colD = abs(floor(p.x / uW) - floor(uRes.x * 0.5 / uW));
        float sw = clamp(uSweep - colD, 0.0, 1.0); // 스윕: 가운데 열에서 멀수록 늦게 끼워짐
        b *= sw;
        vec4 base = flute(tBase, p, b, uShiftT);
        vec4 sh = flute(tShape, p, b, uShift);
        vec4 tx = flute(tText, p, b, uShiftT);
        vec3 c = base.rgb * (1.0 - sh.a) + sh.rgb;
        c = c * (1.0 - tx.a) + tx.rgb;
        vec2 uv = (p + b * 2.0 * uShift) / uRes;
        vec3 bl = vec3(0.0);
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 0.5236;
          for (int j = 1; j <= 2; j++) bl += max(texture2D(tShape, uv + vec2(cos(a), sin(a)) * uBloomR * float(j) / uRes).rgb - 0.55, 0.0);
        }
        c += bl * uBloom / 24.0;
        c += sw * (1.0 - sw) * 0.24; // 끼워지는 열이 살짝 밝게 스침
        gl_FragColor = vec4(c, 1.0);
      }`,
		depthTest: false,
		depthWrite: false,
	});
	const fluteScene = fullScreen(fluteMat);

	/* ───────── 4. 도형: 4 → 6 → 8각 너트 ─────────
	   모든 도형을 같은 토폴로지(둘레 N분할 × 단면 4변 S분할)로 만들어 정점 수가 같음 → 셰이더에서 바로 보간 */
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
	camera.position.set(0, 0, 10);
	const N = 240,
		S = 16,
		K = S * 4;
	const SIDES = [4, 6, 8];
	const CORNER = { 4: Math.PI / 4, 6: Math.PI / 2, 8: 0 }; // 꼭짓점이 샘플 각도에 맞도록 시작 각도
	const R_OUT = 2.1,
		R_IN = 1.18,
		HALF_T = 0.45; // 바깥 반지름(꼭짓점 기준), 구멍 반지름, 두께의 절반
	const polyR = (n, corner) => (th) => {
		const seg = (Math.PI * 2) / n;
		const l = (((th - corner) % seg) + seg) % seg;
		return (R_OUT * Math.cos(Math.PI / n)) / Math.cos(l - Math.PI / n);
	};
	function buildNut(n) {
		const outR = polyR(n, CORNER[n]);
		// 단면: 바깥벽 → 윗면 → 안쪽벽 → 아랫면 (각 변 S점)
		const prof = (th) => {
			const ro = outR(th);
			const c = [[ro, -HALF_T], [ro, HALF_T], [R_IN, HALF_T], [R_IN, -HALF_T]];
			const pts = [];
			for (let e = 0; e < 4; e++) {
				const [r0, y0] = c[e],
					[r1, y1] = c[(e + 1) % 4];
				for (let i = 0; i < S; i++) {
					const f = i / S,
						r = r0 + (r1 - r0) * f;
					pts.push([Math.cos(th) * r, y0 + (y1 - y0) * f, Math.sin(th) * r]);
				}
			}
			return pts;
		};
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
		g.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2)); // 세워서 정면(로컬 Z)으로
		g.computeVertexNormals();
		return { p: g.attributes.position.array, n: g.attributes.normal.array };
	}
	const SHAPES = SIDES.map(buildNut);

	const geo = new THREE.BufferGeometry();
	const attr = (src) => new THREE.BufferAttribute(new Float32Array(src), 3);
	const aPos = attr(SHAPES[0].p),
		aNrm = attr(SHAPES[0].n),
		bPos = attr(SHAPES[1].p),
		bNrm = attr(SHAPES[1].n);
	geo.setAttribute("position", aPos);
	geo.setAttribute("normal", aNrm);
	geo.setAttribute("aPosB", bPos);
	geo.setAttribute("aNormB", bNrm);
	geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
	function setPair(from, to) {
		aPos.array.set(SHAPES[from].p);
		aNrm.array.set(SHAPES[from].n);
		bPos.array.set(SHAPES[to].p);
		bNrm.array.set(SHAPES[to].n);
		aPos.needsUpdate = aNrm.needsUpdate = bPos.needsUpdate = bNrm.needsUpdate = true;
	}
	const prism = new THREE.Mesh(geo);
	prism.frustumCulled = false;
	scene.add(prism);

	// 모바일에서 WebGL을 회수했다가 돌려주면 글자 텍스처 다시 올림
	canvas.addEventListener("webglcontextrestored", () => {
		titleCv.tex.needsUpdate = projCv.tex.needsUpdate = true;
	});

	let W = 0,
		H = 0;
	function resize() {
		W = wrap.clientWidth || 1;
		H = wrap.clientHeight || 1;
		renderer.setSize(W, H, false);
		RTS.forEach((rt) => rt.setSize(W * DPR, H * DPR));
		res.value.set(W * DPR, H * DPR);
		glow.value.set(W * 0.95 * DPR, H * DPR); // 배경 빛: 오른쪽 위
		drawTitle(W, H);
		drawProj(W, H);
		camera.aspect = W / H;
		camera.position.z = W / H < 0.9 ? (10 / (W / H)) * 0.8 : 10; // 세로 화면은 뒤로 빠져서 다 보이게
		camera.updateProjectionMatrix();
	}
	new ResizeObserver(resize).observe(wrap);
	resize();
	document.fonts.ready.then(markDirty);

	/* ───────── 5. 입력: 도형 드래그 회전 (놓으면 관성) ───────── */
	const ray = new THREE.Raycaster(),
		hitMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
		ndc = new THREE.Vector2();
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
	// 프로젝트 섹션·링크 위에서는 반응 안 함
	const isUI = (e) => e.target.closest && e.target.closest("a, button, input, label, select, textarea, #project_site");
	// 커서 상태: cursor.js가 <html data-cursor>를 읽음 (없으면 기본 커서), 인트로 중엔 항상 "skip"
	function setCursor(s) {
		if (!intro.done && !intro.skipped) s = "skip";
		if (s) root.dataset.cursor = s;
		else delete root.dataset.cursor;
		wrap.style.cursor = { drag: "grab", grabbing: "grabbing" }[s] || "";
	}
	const qUser = new THREE.Quaternion(),
		qStep = new THREE.Quaternion();
	const AX = new THREE.Vector3(1, 0, 0),
		AY = new THREE.Vector3(0, 1, 0),
		AZ = new THREE.Vector3(0, 0, 1);
	const drag = { on: false, x: 0, y: 0, vx: 0, vy: 0 };
	function spinBy(dx, dy) {
		qStep.setFromAxisAngle(AY, dx);
		qUser.premultiply(qStep);
		qStep.setFromAxisAngle(AX, dy);
		qUser.premultiply(qStep);
	}
	window.addEventListener("pointerdown", (e) => {
		if (isUI(e) || !hitShape(e)) return;
		e.preventDefault();
		Object.assign(drag, { on: true, x: e.clientX, y: e.clientY, vx: 0, vy: 0 });
		setCursor("grabbing");
	});
	window.addEventListener("pointermove", (e) => {
		if (!drag.on) return setCursor(!isUI(e) && hitShape(e) ? "drag" : "");
		const k = CFG.dragSpeed;
		drag.vx = (e.clientX - drag.x) * k;
		drag.vy = (e.clientY - drag.y) * k;
		drag.x = e.clientX;
		drag.y = e.clientY;
		spinBy(drag.vx, drag.vy);
	});
	const endDrag = () => {
		if (!drag.on) return;
		drag.on = false;
		setCursor("drag");
	};
	window.addEventListener("pointerup", endDrag);
	window.addEventListener("pointercancel", endDrag);
	window.addEventListener("touchmove", (e) => drag.on && e.preventDefault(), { passive: false }); // 도형 돌릴 땐 스크롤 막기

	/* ───────── 6. 인트로 ─────────
	   1) 로딩: 0 → 100% (4·8의 배수만 표시, 바뀐 자리만 위로 빠지고 새 숫자가 올라옴) + 진행선 — 도형은 작게 돌며 4 → 6 → 8 → 4각으로 변형
	   2) 공개: 로더가 빠지고 도형이 커지며, 칸막이가 가운데 열부터 한 열씩 끼워짐
	   3) 타이틀 글자 → 헤더 → 이후 autoMorph초마다 자동 변형 (로딩 중 클릭하면 100%로 건너뛰고 2)부터 재생) */
	let EASE_L = "power4.out"; // 글자 이징 (cubic-bezier(.35, 0, 0, 1))
	if (HAS_GSAP && window.CustomEase) {
		gsap.registerPlugin(CustomEase);
		EASE_L = CustomEase.create("lusionTitle", "M0,0 C0.35,0 0,1 1,1");
	}
	const CH = { duration: 1 / 1.5, ease: EASE_L, stagger: 1 / 30, onUpdate: markDirty }; // 글자 하나 0.67초, 1/30초 간격
	const showChars = (arr, v, delay = 0) => gsap.to(arr, { ...CH, v, delay });

	const clock = new THREE.Clock();
	// s: 크기 배율, face: 1이면 인트로 자세(rx·ry)로 고정, lm: 로딩 중 변형 진행(0~3, -1 = 끝)
	const intro = { done: true, s: 1, face: 0, rx: 0.4, ry: -0.55, lm: -1, skipped: false };
	const stage = { from: 0, to: 1, start: -1, last: 0 }; // 자동 변형 상태 (start < 0 = 대기)
	let curFrom = -1,
		introStart = null;
	let titleOut = false; // 스크롤로 타이틀이 빠진 상태 (7번에서 사용)

	if (PLAY_INTRO) {
		Object.assign(intro, { done: false, s: 0.5, face: 1, lm: 0 });
		fluteMat.uniforms.uSweep.value = 0;
		const hdr = document.querySelectorAll("#header .logo, #header #gnb li, #header .m_menu_btn");
		gsap.set(hdr, { autoAlpha: 0, y: -16 });
		root.classList.remove("intro-pending");

		const font = `"${CFG.fontFamily}", "Unbounded", sans-serif`;
		const numSize = Math.round((fontSize(window.innerWidth) * 2) / 3); // 숫자 = 타이틀의 2/3
		const PCT = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 100];
		const box = document.createElement("div");
		box.className = "intro2";
		box.innerHTML = `
			<div class="i2-meta">
				<span class="i2-count"><span class="i2-num">${'<span class="i2-d"><i>0</i><b>0</b></span>'.repeat(3)}</span><span class="i2-pct">%</span></span>
				<span class="i2-label">Loading</span>
			</div>
			<div class="i2-bar"><i></i></div>`;
		const css = document.createElement("style");
		css.textContent = `
			.intro2 { --side: 80px; --bot: 40px; --gap: 40px; position: fixed; inset: 0; z-index: 60; pointer-events: none; color: #fff; font-family: ${font}; }
			@media (max-width: 1660px) { .intro2 { --side: 40px; } }
			@media (max-width: 768px) { .intro2 { --side: 20px; } }
			.intro2 .i2-meta { position: absolute; left: var(--side); right: var(--side); bottom: calc(var(--bot) + 1px + var(--gap)); display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; line-height: 16px; font-weight: 100; letter-spacing: 0.08em; text-transform: uppercase; }
			.intro2 .i2-count { font-size: ${numSize}px; line-height: 1; letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; }
			.intro2 .i2-num { font-weight: 900; }
			.intro2 .i2-pct { margin-left: 4px; font-size: 12px; line-height: 16px; letter-spacing: 0.08em; opacity: 0.3; }
			.intro2 .i2-label { opacity: 0.3; }
			.intro2 .i2-d { position: relative; display: inline-block; overflow: hidden; vertical-align: bottom; }
			.intro2 .i2-d i { display: block; font-style: normal; visibility: hidden; } /* 자리 크기만 잡음 */
			.intro2 .i2-d b { position: absolute; left: 0; top: 0; font-weight: inherit; will-change: transform; }
			.intro2 .i2-bar { position: absolute; left: var(--side); right: var(--side); bottom: var(--bot); height: 1px; background: rgba(255,255,255,0.1); overflow: hidden; }
			.intro2 .i2-bar i { position: absolute; inset: 0; background: #fff; transform-origin: 0 50%; transform: scaleX(0); }`;
		document.head.appendChild(css);
		document.body.appendChild(box);
		const $ = (q) => box.querySelector(q);
		const loader = [$(".i2-meta"), $(".i2-bar")];
		const bar = $(".i2-bar i");

		// 글자 아랫선(베이스라인)이 선에서 정확히 --gap 위에 오도록, 줄 높이 여백만큼 내림
		const fitBase = () => {
			const cx = document.createElement("canvas").getContext("2d");
			const pad = (weight, fs, lh) => {
				cx.font = `${weight} ${fs}px ${font}`;
				const mt = cx.measureText("0");
				return mt.fontBoundingBoxAscent ? (lh - mt.fontBoundingBoxAscent + mt.fontBoundingBoxDescent) / 2 : 0;
			};
			$(".i2-count").style.marginBottom = -pad(900, numSize, numSize) + "px";
			$(".i2-label").style.marginBottom = -pad(100, 12, 16) + "px";
		};
		fitBase();
		document.fonts.ready.then(fitBase);

		// 숫자 롤링: 바뀐 자리만 기존 숫자는 위로 빠지고 새 숫자가 아래에서 올라옴 (중간 숫자는 안 보임)
		// 굴러가는 중에 다음 값이 오면 끊지 않고 지금 위치에서 이어서 빠짐
		const slots = [...box.querySelectorAll(".i2-d")];
		const roll = { duration: 0.45, ease: "power3.out", overwrite: true };
		let numStr = "000";
		const setNum = (str) => {
			if (str === numStr) return;
			slots.forEach((slot, i) => {
				if (str[i] === numStr[i]) return;
				const delay = i * 0.04;
				slot.querySelectorAll("b:not(.out)").forEach((old) => {
					old.classList.add("out"); // 이미 빠지는 숫자는 그대로 두고, 지금 보이는(올라오는) 숫자만 빼냄
					gsap.to(old, { yPercent: -100, ...roll, delay, onComplete: () => old.remove() });
				});
				const nu = document.createElement("b");
				nu.textContent = str[i];
				slot.appendChild(nu);
				gsap.fromTo(nu, { yPercent: 100 }, { yPercent: 0, ...roll, delay });
			});
			numStr = str;
		};

		const colsMax = Math.ceil(window.innerWidth / 2 / CFG.fluteWidth) + 2;
		const load = { p: 0 };
		let tl = null;
		const finish = () => {
			// 로딩이 4각으로 끝났으니 평소 변형은 4 → 6각부터
			Object.assign(intro, { done: true, lm: -1 });
			Object.assign(stage, { from: 0, to: 1, start: -1, last: clock.getElapsedTime() });
			curFrom = -1;
			if (root.dataset.cursor === "skip") setCursor("");
			fluteMat.uniforms.uSweep.value = 999;
			box.remove();
			css.remove();
		};
		introStart = () => {
			const R = 0.2 + CFG.loadTime; // 공개 시작 시점 (로딩 끝나기 0.1초 전)
			tl = gsap.timeline({ onComplete: finish }).timeScale(CFG.introSpeed);
			tl.from(loader, { y: 16, autoAlpha: 0, duration: 0.5, ease: "power3.out", stagger: 0.06 }, 0.1)
				// 1) 로딩
				.to(load, {
					p: 1,
					duration: CFG.loadTime,
					ease: "sine.inOut",
					onUpdate() {
						intro.lm = load.p * SHAPES.length;
						setNum(String(PCT[Math.floor(load.p * (PCT.length - 1) + 1e-4)]).padStart(3, "0"));
						bar.style.transform = `scaleX(${load.p})`;
					},
				}, 0.3)
				// 2) 공개
				.addLabel("reveal", R)
				.to(loader, { y: -16, autoAlpha: 0, duration: 0.7, ease: "power2.inOut", stagger: 0.06 }, R)
				.to(intro, { s: 1, duration: 2.0, ease: "power3.inOut" }, R)
				.add(() => gsap.fromTo(flash, { value: 0.35 }, { value: 0, duration: 1.6, ease: "power2.out" }), R + 0.2)
				.to(fluteMat.uniforms.uSweep, { value: colsMax, duration: 1.6, ease: "power2.inOut" }, R + 0.2)
				.to(intro, { face: 0, duration: 2.6, ease: "power3.inOut" }, R + 0.4)
				// 3) 타이틀 → 헤더
				.add(() => !titleOut && showChars(titleFlat, 0), R + 1.2)
				.to(hdr, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.06 }, R + 1.6);
		};
		// 스킵: 로딩만 100%로 넘기고 공개 애니메이션은 그대로 재생 (공개가 시작된 뒤엔 클릭 무시)
		window.addEventListener("click", () => {
			if (!tl || intro.done || intro.skipped || tl.time() >= tl.labels.reveal) return;
			intro.skipped = true;
			tl.seek("reveal", false); // false: 건너뛴 구간의 콜백도 실행 → 숫자 100%, 진행선 끝까지
			if (root.dataset.cursor === "skip") setCursor("");
		});
	} else {
		root.classList.remove("intro-pending");
	}

	/* ───────── 7. 스크롤 ─────────
	   캔버스는 화면에 고정, 스크롤 양(화면 높이 단위)만 읽음
	   0.12화면↓ 타이틀 빠지고 PROJECT 올라옴 / 1.6화면↓ PROJECT도 빠짐 (다시 올리면 반대로) */
	const scr = { t: 0, p: 0 };
	let projOut = false;
	function setTitleOut(o) {
		if (o === titleOut || !HAS_GSAP) return;
		titleOut = o;
		gsap.killTweensOf(titleFlat);
		gsap.killTweensOf(projChars);
		if (o) {
			showChars(titleFlat, 1);
			showChars(projChars, 0, 0.3);
		} else {
			showChars(projChars, -1);
			showChars(titleFlat, 0, 0.2);
		}
	}
	function setProjOut(o) {
		if (o === projOut || !HAS_GSAP) return;
		projOut = o;
		gsap.killTweensOf(projChars);
		showChars(projChars, o ? 1 : 0);
	}
	function onScroll() {
		scr.t = window.scrollY / (window.innerHeight || 1);
		if (scr.t > 0.12) setTitleOut(true);
		else if (scr.t < 0.06) {
			projOut = false;
			setTitleOut(false);
		}
		if (titleOut) {
			if (scr.t > 1.6) setProjOut(true);
			else if (scr.t < 1.5) setProjOut(false);
		}
	}
	if (!reduce) {
		root.classList.add("has-proj-fx"); // PROJECT는 캔버스가 그리므로 DOM 제목은 CSS로 숨김
		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll(); // 새로고침 시 내려가 있으면 바로 그 상태로
	}

	// 인트로 동안 스크롤 잠금 (html.intro-lock): 스크롤바는 그대로 두고 휠·터치·키만 막음, 스크롤바를 끌어도 맨 위로
	let scrollLock = root.classList.contains("intro-lock");
	const LOCK_EVENTS = ["wheel", "touchmove", "keydown"];
	const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"];
	const blockScroll = (e) => {
		if (e.type === "keydown" && !SCROLL_KEYS.includes(e.key)) return;
		e.preventDefault();
		e.stopPropagation(); // Lenis까지 안 가게
	};
	const keepTop = () => window.scrollY && window.scrollTo(0, 0);
	if (scrollLock) {
		LOCK_EVENTS.forEach((ev) => window.addEventListener(ev, blockScroll, { capture: true, passive: false }));
		window.addEventListener("scroll", keepTop, { passive: true });
		keepTop();
	}
	function unlockScroll() {
		scrollLock = false;
		root.classList.remove("intro-lock");
		LOCK_EVENTS.forEach((ev) => window.removeEventListener(ev, blockScroll, { capture: true }));
		window.removeEventListener("scroll", keepTop);
		if (window.lenis) window.lenis.scrollTo(0, { immediate: true, force: true });
		if (window.ScrollTrigger) ScrollTrigger.refresh();
	}

	/* ───────── 8. 매 프레임 ───────── */
	const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
	function stageAt(t) {
		if (stage.start < 0) return { from: stage.from, to: stage.to, u: 0 };
		const c = (t - stage.start) / CFG.morph;
		if (c < 1) return { from: stage.from, to: stage.to, u: ease(c) };
		// 변형 완료 → 다음 쌍 준비
		stage.from = stage.to;
		stage.to = (stage.to + 1) % SHAPES.length;
		stage.start = -1;
		return { from: stage.from, to: stage.to, u: 0 };
	}
	const mo = reduce ? 0 : 1; // 움직임 줄이기 설정이면 0
	const kick = { from: -1, acc: 0, amt: 0 }; // 변형할 때 정면 축으로 한 칸(다음 도형 꼭짓점 간격) 도는 각도
	const qA = new THREE.Quaternion(),
		qB = new THREE.Quaternion(),
		qFx = new THREE.Quaternion();
	const eA = new THREE.Euler(),
		eB = new THREE.Euler(),
		eFx = new THREE.Euler();
	let spinAcc = 0,
		lastT = 0,
		frame = 0,
		visible = true;
	new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(wrap);

	function tick() {
		requestAnimationFrame(tick);
		if (scrollLock) intro.done ? unlockScroll() : keepTop();
		if (!visible) return;
		if (introStart && ++frame === 3) introStart(); // 셰이더 컴파일 멈칫 뒤에 시작
		const t = clock.getElapsedTime();

		// 변형: 인트로 중엔 로딩 진행(lm)을 따르고, 끝나면 autoMorph초마다 다음 도형으로
		if (!reduce && intro.done && stage.start < 0 && !drag.on && t - stage.last >= CFG.autoMorph) stage.start = stage.last = t;
		let st = stageAt(t);
		if (intro.lm >= 0) {
			const f = Math.min(SHAPES.length - 1, Math.floor(intro.lm));
			st = { from: f, to: (f + 1) % SHAPES.length, u: Math.min(1, intro.lm - f) };
		}
		if (st.from !== curFrom) {
			setPair(st.from, st.to);
			curFrom = st.from;
		}
		const u = st.u;
		morph.value = u;
		if (st.from !== kick.from) {
			kick.acc += kick.amt; // 끝난 변형만큼 누적 (자세가 튀지 않게)
			kick.amt = 0;
			kick.from = st.from;
		}
		if (u > 0 && kick.amt === 0) kick.amt = (Math.PI * 2) / SIDES[st.to];
		const bump = Math.sin(u * Math.PI); // 변형 중간에 최대

		// 자세: 기본 흔들림 + 변형 중 살짝 젖힘 → (인트로 자세) → 정면 축 회전 → 드래그 → 스크롤·계속 회전
		eA.set(0.42 + (Math.sin(t * 0.4) * 0.12 + bump * 0.35) * mo, -0.35 + Math.sin(t * 0.27) * 0.25 * mo, -0.12 + Math.sin(t * 0.2) * 0.05 * mo);
		prism.quaternion.setFromEuler(eA);
		if (intro.face > 0) {
			eB.set(intro.rx, intro.ry, 0);
			qB.setFromEuler(eB);
			prism.quaternion.slerp(qB, intro.face);
		}
		qA.setFromAxisAngle(AZ, (kick.acc + kick.amt * u) * mo);
		prism.quaternion.multiply(qA);
		if (!drag.on && (Math.abs(drag.vx) > 1e-5 || Math.abs(drag.vy) > 1e-5)) {
			spinBy(drag.vx, drag.vy);
			drag.vx *= CFG.dragInertia;
			drag.vy *= CFG.dragInertia;
		}
		prism.quaternion.premultiply(qUser);
		scr.p += (scr.t - scr.p) * 0.2;
		spinAcc += t - lastT;
		lastT = t;
		eFx.set(Math.min(1, scr.p) * 0.6 + scr.p * 0.25, scr.p * Math.PI * 0.6 + spinAcc * CFG.spin * mo, 0);
		qFx.setFromEuler(eFx);
		prism.quaternion.premultiply(qFx);
		prism.position.set(0, 0, 1.2); // 화면 가운데 고정 (z 1.2 = 기본 크기)
		prism.scale.setScalar((1 + bump * 0.1) * intro.s); // 변형 중 살짝 커졌다 돌아옴
		fluteMat.uniforms.uBloom.value = CFG.bloom * (1 + bump * 0.8 + flash.value * 2.0);

		if (txtDirty) {
			txtDirty = false;
			drawTitle(W, H);
			drawProj(W, H);
		}

		// 렌더: 배경 → (배경 + 뒷면) → 앞면만 투명 레이어 → 글자 투명 레이어 → 칸막이로 합성
		renderer.setRenderTarget(rtBg);
		renderer.clear();
		renderer.render(bgScene, orthoCam);
		renderer.setRenderTarget(rtBack);
		renderer.clear();
		renderer.render(bgScene, orthoCam);
		prism.material = backMat;
		renderer.render(scene, camera);
		prism.material = frontMat;
		renderer.setClearAlpha(0);
		renderer.setRenderTarget(rtShape);
		renderer.clear();
		renderer.render(scene, camera);
		renderer.setRenderTarget(rtText);
		renderer.clear();
		renderer.render(titleScene, orthoCam);
		if (projChars.some((c) => Math.abs(c.v) < 1)) renderer.render(projScene, orthoCam);
		renderer.setClearAlpha(1);
		renderer.setRenderTarget(null);
		renderer.clear();
		renderer.render(fluteScene, orthoCam);
	}
	tick();
})();
