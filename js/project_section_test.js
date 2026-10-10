/*
 * [TEST] 프로젝트 섹션 — WebGL 없이 GSAP + ScrollTrigger만 사용 (가볍게)
 * 스크롤 양에 따라(scrub, 위로 올리면 되감김) — 천천히, 부드럽게 따라옴:
 *   1) 카드가 아래에서 올라오며 살짝 기울어진 상태 → 똑바로, 가장자리가 잘린 상태(clip-path) → 전체가 펼쳐짐
 *   2) 카드 안 이미지는 스크롤에 따라 위아래로 천천히 움직임 (패럴랙스)
 *   3) 태그 칩·프로젝트명이 카드보다 조금 늦게 따라 들어옴
 * 호버(1024px 이상 + 마우스 기기만): 바로가기 아이콘이 마우스를 살짝 따라감
 *   (이미지 확대·소개 오버레이는 CSS — test.html의 @media (min-width: 1024px) and (hover: hover))
 * 모션 줄이기 설정이면 애니메이션 없이 그대로 보여 줌
 */
(function () {
	if (!window.gsap || !window.ScrollTrigger) return;
	gsap.registerPlugin(ScrollTrigger);
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	var cfg = Object.assign(
		{
			rise: 120, // 카드가 올라오는 거리(px)
			tilt: 2, // 올라올 때 기울기(도) — 왼쪽 카드는 -, 오른쪽 카드는 +
			start: "top bottom", // 등장 시작: 카드 윗변이 화면 맨 아래
			end: "top 30%", // 등장 끝: 카드 윗변이 화면 30% 지점 (값이 작을수록 더 길게 스크롤해야 끝남 = 천천히)
			smooth: 1.2, // 스크롤을 따라오는 지연(초) — 클수록 느리고 부드럽게
			parallax: 8, // 이미지가 위아래로 움직이는 범위(%)
			hoverIcon: 8, // 호버 시 아이콘이 마우스를 따라가는 거리(px)
		},
		window.PROJECT_SECTION_CONFIG || {}
	);

	var cards = gsap.utils.toArray("#project_site .pro_site");

	cards.forEach(function (box) {
		var a = box.querySelector(".pro_card");
		var img = box.querySelector(".pro_img");
		var tags = box.querySelectorAll(".pro_tag li");
		var name = box.querySelector(".pro_name");
		var isLeft = box.getBoundingClientRect().left + box.offsetWidth / 2 < window.innerWidth / 2;

		// 1) + 3) 등장
		var tl = gsap.timeline({
			scrollTrigger: { trigger: box, start: cfg.start, end: cfg.end, scrub: cfg.smooth },
			defaults: { ease: "none" },
		});
		tl.fromTo(box, { y: cfg.rise, rotation: isLeft ? -cfg.tilt : cfg.tilt }, { y: 0, rotation: 0, ease: "power1.out" }, 0)
			.fromTo(a, { clipPath: "inset(12% 8% 12% 8% round 8px)" }, { clipPath: "inset(0% 0% 0% 0% round 8px)", ease: "power1.out" }, 0)
			.fromTo(tags, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08 }, 0.4)
			.fromTo(name, { x: 24, autoAlpha: 0 }, { x: 0, autoAlpha: 1 }, 0.5);

		// 2) 이미지 패럴랙스: 카드가 화면을 지나가는 동안 계속
		if (img) {
			gsap.fromTo(
				img,
				{ yPercent: -cfg.parallax },
				{ yPercent: cfg.parallax, ease: "none", scrollTrigger: { trigger: box, start: "top bottom", end: "bottom top", scrub: cfg.smooth } }
			);
		}
	});

	// 호버: 1024px 이상 + 마우스(hover 가능) 기기에서만 아이콘이 마우스를 따라감
	var mm = gsap.matchMedia();
	mm.add("(min-width: 1024px) and (hover: hover)", function () {
		var offs = [];
		cards.forEach(function (box) {
			var a = box.querySelector(".pro_card");
			var go = box.querySelector(".pro_go");
			if (!go) return;
			var gx = gsap.quickTo(go, "x", { duration: 0.6, ease: "power3.out" });
			var gy = gsap.quickTo(go, "y", { duration: 0.6, ease: "power3.out" });
			function move(e) {
				var r = a.getBoundingClientRect();
				gx(((e.clientX - r.left) / r.width - 0.5) * cfg.hoverIcon * 2);
				gy(((e.clientY - r.top) / r.height - 0.5) * cfg.hoverIcon * 2);
			}
			function leave() {
				gx(0);
				gy(0);
			}
			a.addEventListener("mousemove", move);
			a.addEventListener("mouseleave", leave);
			offs.push(function () {
				a.removeEventListener("mousemove", move);
				a.removeEventListener("mouseleave", leave);
				gsap.set(go, { x: 0, y: 0 });
			});
		});
		return function () {
			offs.forEach(function (f) {
				f();
			});
		};
	});
})();
