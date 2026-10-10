/*
 * [TEST] 프로젝트 섹션 — WebGL 없이 GSAP + ScrollTrigger만 사용 (가볍게)
 * 스크롤 양에 따라(scrub, 위로 올리면 되감김):
 *   1) 카드가 아래에서 위로 닦이듯 열림(clip-path) + 안쪽 이미지는 크게 확대된 상태에서 제자리로 줌아웃
 *   2) 2열일 때 오른쪽 열은 왼쪽 열보다 느리게 움직여 엇갈린 격자처럼 보임
 *   3) 태그 칩이 하나씩 올라오고, 프로젝트명은 아래 마스크에서 밀려 올라옴
 *   4) 카드가 화면을 지나가는 동안 이미지가 위아래로 천천히 움직임 (패럴랙스)
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
			zoom: 1.3, // 열리기 전 이미지 확대 배율
			stagger: 80, // (2열) 오른쪽 열이 엇갈리는 거리(px)
			parallax: 6, // 이미지가 위아래로 움직이는 범위(%)
			hoverIcon: 8, // 호버 시 아이콘이 마우스를 따라가는 거리(px)
		},
		window.PROJECT_SECTION_CONFIG || {}
	);

	var cards = gsap.utils.toArray("#project_site .pro_site");
	var list = document.querySelector("#project_site .pro_list");

	cards.forEach(function (box) {
		var a = box.querySelector(".pro_card");
		var img = box.querySelector(".pro_img");
		var tags = box.querySelectorAll(".pro_tag li");
		var name = box.querySelector(".pro_name");

		// 1) + 3) 등장: 카드 윗변이 화면 95% → 45% 지점을 지나는 동안 스크롤 양만큼 진행
		var tl = gsap.timeline({
			scrollTrigger: { trigger: box, start: "top 95%", end: "top 45%", scrub: 0.6 },
			defaults: { ease: "none" },
		});
		tl.fromTo(a, { clipPath: "inset(100% 0% 0% 0% round 8px)" }, { clipPath: "inset(0% 0% 0% 0% round 8px)", ease: "power2.out" }, 0)
			.fromTo(img, { scale: cfg.zoom }, { scale: 1, ease: "power2.out" }, 0)
			.fromTo(tags, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.1 }, 0.45)
			.fromTo(name, { clipPath: "inset(0% 0% 100% 0%)", y: 16 }, { clipPath: "inset(0% 0% 0% 0%)", y: 0 }, 0.5);

		// 4) 이미지 패럴랙스
		if (img) {
			gsap.fromTo(
				img,
				{ yPercent: -cfg.parallax },
				{ yPercent: cfg.parallax, ease: "none", scrollTrigger: { trigger: box, start: "top bottom", end: "bottom top", scrub: true } }
			);
		}
	});

	// 2) 2열(769px 이상)에서만: 오른쪽 열이 엇갈려 움직임
	var mm = gsap.matchMedia();
	mm.add("(min-width: 769px)", function () {
		cards.forEach(function (box, i) {
			if (i % 2 === 0) return; // 오른쪽 열(짝수 번째)만
			gsap.fromTo(
				box,
				{ y: cfg.stagger },
				{ y: -cfg.stagger, ease: "none", scrollTrigger: { trigger: list, start: "top bottom", end: "bottom top", scrub: true } }
			);
		});
	});

	// 호버: 1024px 이상 + 마우스(hover 가능) 기기에서만 아이콘이 마우스를 따라감
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
