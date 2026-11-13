(() => {
  const full = document.getElementById("full-view");
  const share = document.getElementById("share-album");
  const status = document.getElementById("tool-status");
  const url = "https://mserdarkalinmsk-ui.github.io/msk/bs1611/";
  let timer;
  function message(text) {
    clearTimeout(timer);
    status.textContent = text;
    timer = setTimeout(() => { status.textContent = ""; }, 6000);
  }
  function sync() {
    full.textContent = document.fullscreenElement ? "Tam ekrandan çık" : "Tam ekran";
  }
  if (!document.documentElement.requestFullscreen) full.hidden = true;
  full.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      message("Bu tarayıcıda tam ekran açılamadı.");
    }
    sync();
  });
  document.addEventListener("fullscreenchange", sync);
  share.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({title:"Banu & Serdar",url});
      } else {
        await navigator.clipboard.writeText(url);
        message("Albüm bağlantısı kopyalandı.");
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      window.prompt("Paylaşmak için bağlantıyı kopyala", url);
    }
  });
})();
