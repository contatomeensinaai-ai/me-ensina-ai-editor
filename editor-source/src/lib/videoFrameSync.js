const videoSeekStates = new WeakMap();

function getSeekState(video) {
  let state = videoSeekStates.get(video);
  if (!state) {
    state = {
      version: 0,
      targetTime: 0,
      frameRequest: 0,
      videoFrameRequest: 0,
      presentedCallback: null,
    };
    videoSeekStates.set(video, state);
  }
  return state;
}

function watchPresentedFrame(video, state, version) {
  if (typeof video.requestVideoFrameCallback !== "function") {
    const handleSeeked = () => {
      if (state.version !== version) return;
      state.presentedCallback?.(video.currentTime);
    };
    if (video.seeking) video.addEventListener("seeked", handleSeeked, { once: true });
    else window.requestAnimationFrame(handleSeeked);
    return;
  }

  if (state.videoFrameRequest) {
    video.cancelVideoFrameCallback?.(state.videoFrameRequest);
    state.videoFrameRequest = 0;
  }
  const handleFrame = (_now, metadata) => {
    state.videoFrameRequest = 0;
    if (state.version !== version) return;
    const mediaTime = Number.isFinite(metadata?.mediaTime) ? metadata.mediaTime : video.currentTime;
    if (!video.seeking) {
      state.presentedCallback?.(mediaTime);
      return;
    }
    state.videoFrameRequest = video.requestVideoFrameCallback(handleFrame);
  };
  state.videoFrameRequest = video.requestVideoFrameCallback(handleFrame);
}

function applyLatestSeek(video, state) {
  state.frameRequest = 0;
  const version = state.version;
  const targetTime = state.targetTime;
  if (!Number.isFinite(targetTime)) return;
  if (Math.abs(video.currentTime - targetTime) > 0.002) video.currentTime = targetTime;
  watchPresentedFrame(video, state, version);
}

export function requestLatestVideoFrame(video, targetTime, options = {}) {
  if (!video || !Number.isFinite(targetTime)) return;
  const state = getSeekState(video);
  state.version += 1;
  state.targetTime = Math.max(0, targetTime);
  state.presentedCallback = typeof options.onPresented === "function" ? options.onPresented : null;
  if (options.immediate) {
    if (state.frameRequest) window.cancelAnimationFrame(state.frameRequest);
    applyLatestSeek(video, state);
    return;
  }
  if (!state.frameRequest) {
    state.frameRequest = window.requestAnimationFrame(() => applyLatestSeek(video, state));
  }
}

export function cancelLatestVideoFrameRequest(video) {
  const state = video && videoSeekStates.get(video);
  if (!state) return;
  state.version += 1;
  if (state.frameRequest) window.cancelAnimationFrame(state.frameRequest);
  if (state.videoFrameRequest) video.cancelVideoFrameCallback?.(state.videoFrameRequest);
  state.frameRequest = 0;
  state.videoFrameRequest = 0;
  state.presentedCallback = null;
}
