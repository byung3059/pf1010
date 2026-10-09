/*
 * [TEST] 커스텀 스크롤바
 * - 기본 스크롤바는 CSS로 숨기고, 오른쪽에 고정된 트랙 + 썸을 직접 그림
 * - 썸 드래그 / 트랙 클릭으로 이동, Lenis(window.lenis)가 있으면 그걸로 스크롤
 * - 터치 기기는 CSS에서 숨김 (@media (hover: none))
 */
(function () {
	var bar = document.createElement("div");
	bar.className = "c_scrollbar";
	bar.innerHTML = '<span class="thumb"></span>';
	document.body.appendChild(bar);
	var thumb = bar.firstChild;

	var trackH = 0,
		thumbH = 0,
		max = 0,
		drag = null;

	function getY() {
		return window.lenis ? window.lenis.scroll : window.scrollY;
	}
	function goTo(y, immediate) {
		y = Math.max(0, Math.min(max, y));
		if (window.lenis) window.lenis.scrollTo(y, { immediate: immediate });
		else window.scrollTo(0, y);
	}
	function measure() {
		var docH = document.documentElement.scrollHeight,
			vh = window.innerHeight;
		max = docH - vh;
		bar.hidden = max <= 0;
		trackH = bar.clientHeight;
		thumbH = Math.max(40, (trackH * vh) / docH);
		thumb.style.height = thumbH + "px";
		update();
	}
	function update() {
		var p = max > 0 ? getY() / max : 0;
		thumb.style.transform = "translateY(" + p * (trackH - thumbH) + "px)";
	}

	window.addEventListener("scroll", update, { passive: true });
	if (window.lenis) window.lenis.on("scroll", update);
	window.addEventListener("resize", measure);
	if (window.ResizeObserver) new ResizeObserver(measure).observe(document.body);
	measure();

	// 썸 드래그: 이동한 px을 문서 스크롤 양으로 환산
	thumb.addEventListener("pointerdown", function (e) {
		e.preventDefault();
		e.stopPropagation();
		drag = { y: e.clientY, start: getY() };
		thumb.setPointerCapture(e.pointerId);
		bar.classList.add("is-drag");
	});
	thumb.addEventListener("pointermove", function (e) {
		if (!drag) return;
		var ratio = max / Math.max(1, trackH - thumbH);
		goTo(drag.start + (e.clientY - drag.y) * ratio, true);
	});
	function endDrag() {
		drag = null;
		bar.classList.remove("is-drag");
	}
	thumb.addEventListener("pointerup", endDrag);
	thumb.addEventListener("pointercancel", endDrag);

	// 트랙 클릭: 그 위치로 부드럽게 이동
	bar.addEventListener("pointerdown", function (e) {
		if (e.target !== bar) return;
		e.stopPropagation();
		var r = bar.getBoundingClientRect();
		var p = (e.clientY - r.top - thumbH / 2) / Math.max(1, trackH - thumbH);
		goTo(Math.max(0, Math.min(1, p)) * max, false);
	});
})();
