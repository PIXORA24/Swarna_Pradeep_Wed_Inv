(function () {
  "use strict";

  var EVENTS = {
    wedding: {
      title: "Wedding Ceremony",
      calendarTitle: "Swarna and Pradeep Wedding",
      date: "2026-06-29T12:15:00+05:30",
      duration: 4,
      venue: "BAZAR Auditorium",
      address: "Kandur Panemangalore",
      lat: 12.859094718842679,
      lng: 75.03159590167243
    }
  };

  var PREFERS_REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var envelopeScreen = document.getElementById("envelopeScreen");
  var envelope = document.getElementById("envelope");
  var goldenBurst = document.getElementById("goldenBurst");
  var introTransition = document.getElementById("introTransition");
  var navDim = document.getElementById("navDim");
  var mainContent = document.getElementById("mainContent");
  var weddingSection = document.getElementById("weddingSection");
  var weddingVideo = document.getElementById("weddingVideo");
  var backgroundMusic = document.getElementById("bgMusic");
  var soundToggle = document.getElementById("soundToggle");
  var soundToggleLabel = soundToggle.querySelector(".sound-btn__label");
  var scrollHint = document.getElementById("scrollHint");
  var RETURN_STATE_KEY = "swarnaWeddingReturnState";
  var RETURN_STATE_MAX_AGE = 30 * 60 * 1000;

  var state = {
    envelopeOpened: false,
    musicOn: true,
    heroInView: true,
    navigatingAway: false
  };
  var pendingMusicUnlock = false;

  function trackEvent(name, params) {
    if (typeof window.gtag !== "function") {
      return;
    }

    window.gtag("event", name, params || {});
  }

  function clearStoredReturnState() {
    try {
      window.sessionStorage.removeItem(RETURN_STATE_KEY);
    } catch (error) {}
  }

  function readStoredReturnState() {
    try {
      var rawValue = window.sessionStorage.getItem(RETURN_STATE_KEY);
      if (!rawValue) {
        return null;
      }

      var savedState = JSON.parse(rawValue);
      if (!savedState || typeof savedState !== "object") {
        clearStoredReturnState();
        return null;
      }

      if (!savedState.pendingReturn || !savedState.envelopeOpened) {
        clearStoredReturnState();
        return null;
      }

      if (typeof savedState.savedAt !== "number" || Date.now() - savedState.savedAt > RETURN_STATE_MAX_AGE) {
        clearStoredReturnState();
        return null;
      }

      return savedState;
    } catch (error) {
      clearStoredReturnState();
      return null;
    }
  }

  function getMediaTime(media) {
    if (!media || typeof media.currentTime !== "number" || !isFinite(media.currentTime) || media.currentTime < 0) {
      return 0;
    }

    return media.currentTime;
  }

  function saveReturnState(pendingReturn) {
    if (!state.envelopeOpened) {
      clearStoredReturnState();
      return;
    }

    try {
      window.sessionStorage.setItem(RETURN_STATE_KEY, JSON.stringify({
        envelopeOpened: true,
        musicOn: state.musicOn,
        pendingReturn: !!pendingReturn,
        audioTime: getMediaTime(backgroundMusic),
        videoTime: getMediaTime(weddingVideo),
        scrollY: window.scrollY || window.pageYOffset || 0,
        savedAt: Date.now()
      }));
    } catch (error) {}
  }

  function restoreMediaPosition(media, targetTime) {
    if (!media || typeof targetTime !== "number" || !isFinite(targetTime) || targetTime < 0) {
      return;
    }

    function applyTime() {
      try {
        var nextTime = Math.max(targetTime, 0);

        if (isFinite(media.duration) && media.duration > 0) {
          nextTime = Math.min(nextTime, Math.max(media.duration - 0.1, 0));
        }

        media.currentTime = nextTime;
        return true;
      } catch (error) {
        return false;
      }
    }

    if (media.readyState >= 1 && applyTime()) {
      return;
    }

    function handleLoadedMetadata() {
      media.removeEventListener("loadedmetadata", handleLoadedMetadata);
      applyTime();
    }

    media.addEventListener("loadedmetadata", handleLoadedMetadata);
  }

  function updateHeroInViewState() {
    var rect = weddingSection.getBoundingClientRect();
    state.heroInView = rect.top < window.innerHeight * 0.7 && rect.bottom > window.innerHeight * 0.3;
  }

  function formatUtcDate(date) {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  function playMedia(media) {
    try {
      var result = media.play();
      if (result && typeof result.then === "function") {
        return result;
      }
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function pauseMedia(media) {
    if (media) {
      media.pause();
    }
  }

  function setSoundButton() {
    soundToggle.classList.toggle("is-muted", !state.musicOn);
    soundToggleLabel.textContent = state.musicOn ? "Music on" : "Music off";
    soundToggle.setAttribute("aria-label", state.musicOn ? "Turn music off" : "Turn music on");
  }

  function removeMusicUnlockRetry() {
    if (!pendingMusicUnlock) {
      return;
    }

    pendingMusicUnlock = false;
    document.removeEventListener("touchstart", handleMusicUnlockRetry);
    document.removeEventListener("click", handleMusicUnlockRetry);
  }

  function queueMusicUnlockRetry() {
    if (pendingMusicUnlock) {
      return;
    }

    pendingMusicUnlock = true;
    document.addEventListener("touchstart", handleMusicUnlockRetry, { passive: true });
    document.addEventListener("click", handleMusicUnlockRetry);
  }

  function handleMusicUnlockRetry() {
    removeMusicUnlockRetry();

    if (!state.envelopeOpened || state.navigatingAway || document.hidden || !state.musicOn) {
      return;
    }

    syncMusicPlayback();
  }

  function syncVideoPlayback() {
    if (!state.envelopeOpened || state.navigatingAway || document.hidden) {
      return;
    }

    if (!state.heroInView) {
      pauseMedia(weddingVideo);
      return;
    }

    weddingVideo.muted = true;
    playMedia(weddingVideo).catch(function () {});
  }

  function syncMusicPlayback() {
    if (!state.envelopeOpened || state.navigatingAway || document.hidden) {
      return;
    }

    if (!state.musicOn) {
      removeMusicUnlockRetry();
      pauseMedia(backgroundMusic);
      return;
    }

    backgroundMusic.volume = 1;
    playMedia(backgroundMusic)
      .then(function () {
        removeMusicUnlockRetry();
      })
      .catch(function () {
        queueMusicUnlockRetry();
      });
  }

  function syncMedia() {
    syncVideoPlayback();
    syncMusicPlayback();
  }

  function restoreReturnedState() {
    state.navigatingAway = false;
    navDim.classList.remove("active");
    clearStoredReturnState();
    syncMedia();
  }

  function restoreInvitationFromState(savedState) {
    state.envelopeOpened = true;
    state.musicOn = savedState.musicOn !== false;
    state.navigatingAway = false;

    envelope.classList.add("opening");
    envelopeScreen.classList.add("hidden");
    mainContent.classList.add("visible");
    soundToggle.classList.add("visible");
    navDim.classList.remove("active");
    setSoundButton();
    document.documentElement.classList.remove("returning-invite");

    if (typeof savedState.scrollY === "number" && isFinite(savedState.scrollY)) {
      window.scrollTo(0, Math.max(savedState.scrollY, 0));
    }

    updateHeroInViewState();

    if (backgroundMusic) {
      backgroundMusic.preload = "auto";
      restoreMediaPosition(backgroundMusic, savedState.audioTime);
    }

    if (weddingVideo) {
      restoreMediaPosition(weddingVideo, savedState.videoTime);
    }

    syncMedia();
    hideScrollHint();
    clearStoredReturnState();
  }

  function openInvitation() {
    var burstDelay = PREFERS_REDUCED_MOTION ? 80 : 180;
    var letterReleaseDelay = PREFERS_REDUCED_MOTION ? 40 : 260;
    var transitionDelay = PREFERS_REDUCED_MOTION ? 120 : 520;
    var revealDelay = PREFERS_REDUCED_MOTION ? 220 : 820;
    var cleanupDelay = PREFERS_REDUCED_MOTION ? 420 : 1480;

    if (state.envelopeOpened) {
      return;
    }

    state.envelopeOpened = true;
    envelope.classList.remove("letter-raised");
    envelope.classList.add("opening");
    envelopeScreen.classList.add("is-opening");
    document.documentElement.classList.remove("returning-invite");
    clearStoredReturnState();
    trackEvent("invitation_open", {
      source: "envelope"
    });

    if (weddingVideo) {
      weddingVideo.muted = true;
      playMedia(weddingVideo).catch(function () {});
    }

    setTimeout(function () {
      goldenBurst.classList.add("active");
    }, burstDelay);

    setTimeout(function () {
      envelope.classList.add("letter-raised");
    }, letterReleaseDelay);

    setTimeout(function () {
      introTransition.classList.add("active");
    }, transitionDelay);

    setTimeout(function () {
      envelopeScreen.classList.add("hidden");
      mainContent.classList.add("visible");
      soundToggle.classList.add("visible");
      setSoundButton();
      syncMedia();
    }, revealDelay);

    setTimeout(function () {
      goldenBurst.classList.remove("active");
    }, revealDelay + 80);

    setTimeout(function () {
      introTransition.classList.remove("active");
    }, cleanupDelay);
  }

  function handleEnvelopeKey(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openInvitation();
  }

  function hideScrollHint() {
    scrollHint.classList.toggle("is-hidden", window.scrollY > 48);
  }

  function navigateWithFade(url) {
    if (state.navigatingAway) {
      return;
    }

    state.navigatingAway = true;
    navDim.classList.add("active");
    pauseMedia(weddingVideo);
    pauseMedia(backgroundMusic);
    saveReturnState(true);
    try {
      var externalWindow = window.open(url, "_blank");

      if (externalWindow) {
        externalWindow.opener = null;

        setTimeout(function () {
          if (!document.hidden && state.navigatingAway) {
            restoreReturnedState();
          }
        }, 700);
        return;
      }
    } catch (error) {}

    setTimeout(function () {
      window.location.href = url;
    }, 260);
  }

  function buildDirectionsUrl(eventData) {
    var destination = eventData.lat + "," + eventData.lng;

    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destination);
  }

  function buildCalendarUrl(eventData) {
    var start = new Date(eventData.date);
    var end = new Date(start.getTime() + eventData.duration * 3600000);
    var location = eventData.venue + ", " + eventData.address;

    return "https://calendar.google.com/calendar/render?action=TEMPLATE"
      + "&text=" + encodeURIComponent(eventData.calendarTitle)
      + "&dates=" + formatUtcDate(start) + "/" + formatUtcDate(end)
      + "&details=" + encodeURIComponent("You're invited to the wedding of Swarna & Pradeep!\n\n📅 29th June 2026\n🕐 12:15 PM\n📍 BAZAR Auditorium, Kandur Panemangalore\n\nWe look forward to celebrating this special day with you.")
      + "&location=" + encodeURIComponent(location);
  }

  function bindActionButtons() {
    document.querySelectorAll(".map-btn").forEach(function (button) {
      var eventData = EVENTS[button.dataset.event];

      if (!eventData) {
        return;
      }

      var url = buildDirectionsUrl(eventData);
      button.href = url;

      button.addEventListener("click", function (event) {
        event.preventDefault();
        trackEvent("directions_click", {
          invite_event: button.dataset.event
        });
        navigateWithFade(url);
      });
    });

    document.querySelectorAll(".cal-btn").forEach(function (button) {
      var eventData = EVENTS[button.dataset.event];

      if (!eventData) {
        return;
      }

      button.addEventListener("click", function (event) {
        event.preventDefault();
        trackEvent("calendar_click", {
          invite_event: button.dataset.event
        });
        navigateWithFade(buildCalendarUrl(eventData));
      });
    });
  }

  function bindRevealObserver() {
    if (PREFERS_REDUCED_MOTION || !("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(function (element) {
        element.classList.add("visible");
      });
      return;
    }

    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.18 });

    document.querySelectorAll(".reveal").forEach(function (element) {
      revealObserver.observe(element);
    });
  }

  function bindHeroObserver() {
    if (!("IntersectionObserver" in window)) {
      window.addEventListener("scroll", function () {
        updateHeroInViewState();
        syncVideoPlayback();
      }, { passive: true });
      return;
    }

    var heroObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        state.heroInView = entry.intersectionRatio >= 0.28;
        syncVideoPlayback();
      });
    }, { threshold: [0, 0.28, 0.5] });

    heroObserver.observe(weddingSection);
  }

  var savedReturnState = readStoredReturnState();

  envelope.addEventListener("click", openInvitation);
  envelope.addEventListener("keydown", handleEnvelopeKey);
  envelopeScreen.addEventListener("click", openInvitation);

  soundToggle.addEventListener("click", function () {
    state.musicOn = !state.musicOn;
    setSoundButton();
    trackEvent("music_toggle", {
      state: state.musicOn ? "on" : "off"
    });
    syncMusicPlayback();
  });

  document.querySelectorAll(".studio-link").forEach(function (link) {
    link.addEventListener("click", function () {
      trackEvent("instagram_click", {
        destination: "pixora24"
      });
    });
  });


  document.addEventListener("visibilitychange", function () {
    if (!state.envelopeOpened) {
      return;
    }

    if (document.hidden) {
      if (state.navigatingAway) {
        saveReturnState(true);
      }
      pauseMedia(weddingVideo);
      pauseMedia(backgroundMusic);
      return;
    }

    restoreReturnedState();
  });

  window.addEventListener("pageshow", function (event) {
    if (!state.envelopeOpened) {
      return;
    }

    if (event.persisted || state.navigatingAway) {
      restoreReturnedState();
    }
  });

  window.addEventListener("focus", function () {
    if (!state.envelopeOpened || document.hidden) {
      return;
    }

    restoreReturnedState();
  });

  window.addEventListener("pagehide", function () {
    if (!state.envelopeOpened || !state.navigatingAway) {
      return;
    }

    saveReturnState(true);
  });

  window.addEventListener("scroll", hideScrollHint, { passive: true });

  if (weddingVideo) {
    weddingVideo.preload = "auto";
    weddingVideo.load();
  }

  if (savedReturnState) {
    restoreInvitationFromState(savedReturnState);
  }

  function initScratchCard() {
    var wrapper = document.getElementById("scratchWrapper");
    var canvas = document.getElementById("scratchCanvas");
    var hint = document.getElementById("scratchHint");
    var shimmer = document.getElementById("scratchShimmer");

    if (!wrapper || !canvas) {
      return;
    }

    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var logicalW = 0;
    var logicalH = 0;
    var isScratching = false;
    var hasScratched = false;
    var revealed = false;
    var moveCount = 0;
    var BRUSH_RADIUS = 40;
    var REVEAL_THRESHOLD = 0.62;
    var resizeTimer;

    function drawGoldCover() {
      ctx.clearRect(0, 0, logicalW, logicalH);

      var grad = ctx.createLinearGradient(0, 0, logicalW, logicalH);
      grad.addColorStop(0, "#d4a855");
      grad.addColorStop(0.25, "#f0cc7a");
      grad.addColorStop(0.5, "#c89a56");
      grad.addColorStop(0.75, "#e8c070");
      grad.addColorStop(1, "#b8893d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, logicalW, logicalH);

      ctx.save();
      ctx.strokeStyle = "rgba(255, 240, 180, 0.1)";
      ctx.lineWidth = 0.8;
      for (var i = -logicalH; i < logicalW + logicalH; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + logicalH, logicalH);
        ctx.stroke();
      }
      ctx.restore();

      var gleam = ctx.createLinearGradient(0, 0, logicalW * 0.7, logicalH * 0.5);
      gleam.addColorStop(0, "rgba(255, 252, 220, 0.0)");
      gleam.addColorStop(0.35, "rgba(255, 252, 220, 0.22)");
      gleam.addColorStop(1, "rgba(255, 252, 220, 0.0)");
      ctx.fillStyle = gleam;
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Engraved "WEDDING DATE & TIME" label baked into the foil
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var engraveFontSize = Math.max(10, Math.min(14, logicalW / 22));
      ctx.font = "600 " + engraveFontSize + "px 'Cinzel', serif";
      if ("letterSpacing" in ctx) { ctx.letterSpacing = "3px"; }
      var cx = logicalW / 2;
      var cy = logicalH / 2;
      // Inset shadow (down-right)
      ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
      ctx.fillText("WEDDING DATE & TIME", cx + 1, cy + 1);
      // Raised highlight (up-left)
      ctx.fillStyle = "rgba(255, 215, 140, 0.22)";
      ctx.fillText("WEDDING DATE & TIME", cx - 0.5, cy - 0.5);
      // Main engraved text (deep maroon)
      ctx.fillStyle = "rgba(88, 18, 18, 0.68)";
      ctx.fillText("WEDDING DATE & TIME", cx, cy);
      ctx.restore();
    }

    function initCanvas() {
      logicalW = wrapper.offsetWidth;
      logicalH = wrapper.offsetHeight;

      if (logicalW === 0 || logicalH === 0) {
        setTimeout(initCanvas, 80);
        return;
      }

      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      drawGoldCover();
    }

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var src = e.touches ? e.touches[0] : e;
      return {
        x: (src.clientX - rect.left) * (canvas.width / rect.width) / dpr,
        y: (src.clientY - rect.top) * (canvas.height / rect.height) / dpr
      };
    }

    function scratchAt(x, y) {
      ctx.globalCompositeOperation = "destination-out";
      var grad = ctx.createRadialGradient(x, y, 0, x, y, BRUSH_RADIUS);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(0.55, "rgba(0,0,0,0.92)");
      grad.addColorStop(0.88, "rgba(0,0,0,0.5)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    function getRevealPercent() {
      var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      var transparent = 0;
      var total = 0;
      for (var i = 3; i < data.length; i += 16) {
        total++;
        if (data[i] < 128) transparent++;
      }
      return total > 0 ? transparent / total : 0;
    }

    function updateHintFade(pct) {
      if (!hint || hint.classList.contains("is-done")) {
        return;
      }
      var opacity = Math.max(0, 1 - pct / (REVEAL_THRESHOLD * 0.85));
      hint.style.opacity = String(opacity);
      if (opacity <= 0) {
        hint.classList.add("is-done");
      }
    }

    function completeReveal() {
      if (revealed) {
        return;
      }
      revealed = true;
      var fadeDuration = PREFERS_REDUCED_MOTION ? 0 : 700;

      if (hint) {
        hint.classList.add("is-done");
        hint.style.opacity = "0";
      }
      if (shimmer) {
        shimmer.style.transition = "opacity 0.3s ease";
        shimmer.style.opacity = "0";
      }
      canvas.style.transition = "opacity " + (fadeDuration / 1000) + "s ease";
      canvas.style.opacity = "0";

      setTimeout(function () {
        canvas.style.display = "none";
        if (shimmer) {
          shimmer.style.display = "none";
        }
        if (!PREFERS_REDUCED_MOTION) {
          wrapper.classList.add("date-revealed");
        }
      }, fadeDuration);
    }

    function onStart(e) {
      if (revealed) {
        return;
      }
      e.preventDefault();
      isScratching = true;

      if (!hasScratched) {
        hasScratched = true;
        if (shimmer && !PREFERS_REDUCED_MOTION) {
          shimmer.style.transition = "opacity 0.3s ease";
          shimmer.style.opacity = "0";
        }
      }

      var pos = getPos(e);
      scratchAt(pos.x, pos.y);
    }

    function onMove(e) {
      if (!isScratching || revealed) {
        return;
      }
      e.preventDefault();
      var pos = getPos(e);
      scratchAt(pos.x, pos.y);
      moveCount++;
      if (moveCount % 4 === 0) {
        var pct = getRevealPercent();
        updateHintFade(pct);
        if (pct >= REVEAL_THRESHOLD) {
          completeReveal();
        }
      }
    }

    function onEnd() {
      if (!isScratching) {
        return;
      }
      isScratching = false;
      if (hasScratched && !revealed) {
        var pct = getRevealPercent();
        updateHintFade(pct);
        if (pct >= REVEAL_THRESHOLD) {
          completeReveal();
        }
      }
    }

    canvas.addEventListener("mousedown", onStart);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    canvas.addEventListener("touchstart", onStart, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onEnd);

    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!revealed) {
          initCanvas();
        }
      }, 300);
    });

    if (PREFERS_REDUCED_MOTION) {
      canvas.addEventListener("click", completeReveal, { once: true });
    }

    setTimeout(initCanvas, 0);
  }

  function initRsvpDropdown() {
    var rsvpToggle = document.getElementById("rsvpToggle");
    var rsvpDropdown = document.getElementById("rsvpDropdown");

    if (!rsvpToggle || !rsvpDropdown) {
      return;
    }

    var isOpen = false;

    function openDropdown() {
      isOpen = true;
      rsvpToggle.setAttribute("aria-expanded", "true");

      rsvpDropdown.style.transition = "none";
      rsvpDropdown.style.height = "0px";
      rsvpDropdown.style.opacity = "0";
      rsvpDropdown.style.marginTop = "0px";

      void rsvpDropdown.offsetHeight; // force reflow before applying transition

      var dur = PREFERS_REDUCED_MOTION ? "0.01ms" : "0.38s";
      var ease = "cubic-bezier(0.4,0,0.2,1)";
      rsvpDropdown.style.transition =
        "height " + dur + " " + ease + "," +
        "opacity " + dur + " ease," +
        "margin-top " + dur + " ease";
      rsvpDropdown.style.height = rsvpDropdown.scrollHeight + "px";
      rsvpDropdown.style.opacity = "1";
      rsvpDropdown.style.marginTop = "8px";
    }

    function closeDropdown() {
      isOpen = false;
      rsvpToggle.setAttribute("aria-expanded", "false");

      var dur = PREFERS_REDUCED_MOTION ? "0.01ms" : "0.3s";
      var ease = "cubic-bezier(0.4,0,0.2,1)";
      rsvpDropdown.style.transition =
        "height " + dur + " " + ease + "," +
        "opacity " + dur + " ease," +
        "margin-top " + dur + " ease";
      rsvpDropdown.style.height = "0px";
      rsvpDropdown.style.opacity = "0";
      rsvpDropdown.style.marginTop = "0px";
    }

    rsvpToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (isOpen) { closeDropdown(); } else { openDropdown(); }
    });

    rsvpDropdown.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    rsvpDropdown.querySelectorAll(".rsvp-option").forEach(function (option) {
      option.addEventListener("click", function (e) {
        e.preventDefault();
        var msg = option.dataset.msg;
        window.open(
          "https://wa.me/919740451921?text=" + encodeURIComponent(msg),
          "_blank",
          "noopener,noreferrer"
        );
        closeDropdown();
        trackEvent("rsvp_click", {
          destination: "whatsapp",
          response: option.querySelector(".rsvp-option__text").textContent.trim()
        });
        var label = rsvpToggle.querySelector(".rsvp-btn__label");
        if (label) {
          label.textContent = "RSVP sent \u2713";
          setTimeout(function () { label.textContent = "RSVP"; }, 3000);
        }
      });
    });

    document.addEventListener("click", function () {
      if (isOpen) { closeDropdown(); }
    });
  }

  bindActionButtons();
  bindRevealObserver();
  bindHeroObserver();
  initScratchCard();
  initRsvpDropdown();
  updateHeroInViewState();
  hideScrollHint();
  setSoundButton();
})();
