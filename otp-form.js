/*
 * otp-form.js — Unified OTP / verification-code component (vanilla JS).
 *
 * This is the single source of truth for every OTP code-entry form on the site.
 * It is also embedded verbatim into site-bundle.js under a `/* Source: otp-form.js *​/`
 * section marker (the bundle is the deployed artifact). Keep the two in sync:
 * edit the bundle hunk and this file with the identical change.
 *
 * What it owns (so individual pages no longer duplicate it):
 *   - the 6-slot (or N-slot) visual code field rendered over a hidden <input>,
 *   - the shared OTP styling (.otp-slot-row / .otp-hidden-input / .unified-otp-modal),
 *   - the active/filled slot states,
 *   - the "confirm button lights up when the code is complete" cue (.otp-complete).
 *
 * Differences between forms come ONLY from options / data-* attributes ("props"):
 *   window.OtpForm.enhance(inputEl, {
 *     length:        Number  // otpLength; defaults to data-otp-length, then maxlength, then 6
 *     confirmButton: String  // id of the confirm button to light up (data-otp-confirm)
 *     onChange:      (code, isComplete) => void
 *     onComplete:    (code) => void          // fires once when the code reaches `length`
 *   });
 *
 * Per-input data attributes (no JS needed):
 *   data-otp-length="6"      data-otp-confirm="someConfirmBtnId"
 *
 * Title / subtitle / target / resend button / countdown / error text / loading
 * remain owned by each form's own markup + handlers; this component only unifies
 * the field, its styling, and the completion cue. Auto-scan wires the known
 * inputs (login 2FA, telegram-link, security-email, security 2FA, transfer).
 */
;(function installUnifiedOtpSurface(){
  if (window.__unifiedOtpSurfaceInstalled) return;
  window.__unifiedOtpSurfaceInstalled = true;
  function ensureStyle(){
    if (document.getElementById("unified-otp-surface-style")) return;
    var style = document.createElement("style");
    style.id = "unified-otp-surface-style";
    style.textContent = [
      "html body .modal .security-code-modal,html body .modal .totp-modal,html body .transfer-modal-backdrop .transfer-modal.transfer-totp-modal{width:min(100%,430px)!important;min-height:auto!important;margin:0 auto!important;padding:12px clamp(18px,5vw,30px) 24px!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:var(--otp-page-bg,#fff)!important;color:var(--otp-text,#202a49)!important;text-align:center!important;direction:rtl!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:12px!important;}",
      "html body .modal.unified-otp-modal:not(.hidden),html body .transfer-modal-backdrop.unified-otp-modal:not(.hidden),html body .modal:not(.hidden):has(.security-code-modal),html body .modal:not(.hidden):has(.totp-modal),html body .transfer-modal-backdrop:not(.hidden):has(.transfer-totp-modal){position:fixed!important;inset:0!important;z-index:99999!important;display:grid!important;place-items:start center!important;overflow:auto!important;background:var(--otp-page-bg,#fff)!important;padding:14px 12px 24px!important;backdrop-filter:none!important;}",
      "body.dark-mode,html[data-theme='dark']{--otp-page-bg:var(--bg-app,var(--site-accent-runtime-surface,#07090f));--otp-text:var(--text,#f5f7ff);--otp-muted:var(--muted,var(--site-accent-runtime-light,#d8dcef));--otp-line:rgba(var(--site-accent-rgb,148,163,184),.56);--otp-box:var(--site-accent-runtime-surface-alt,#0b0e17);--otp-accent:var(--site-accent-runtime,var(--accent-theme,#5c5ebf));--otp-btn:linear-gradient(135deg,var(--site-accent-runtime,var(--accent-theme,#5c5ebf)),var(--site-accent-runtime-strong,var(--primary-dark,var(--accent-theme,#3b3e8c))));--otp-btn-text:#fff;}",
      "body:not(.dark-mode),html[data-theme='light']{--otp-page-bg:var(--bg-app,#fff);--otp-text:var(--text,#060606);--otp-muted:#111;--otp-line:rgba(var(--site-accent-rgb,148,163,184),.5);--otp-box:#fff;--otp-accent:var(--site-accent-runtime,var(--accent-theme,#5c5ebf));--otp-btn:linear-gradient(135deg,var(--site-accent-runtime,var(--accent-theme,#5c5ebf)),var(--site-accent-runtime-strong,var(--primary-dark,var(--accent-theme,#3b3e8c))));--otp-btn-text:#fff;}",
      "html body .security-code-modal::before,html body .totp-modal::before,html body .transfer-totp-modal::before{content:\"\";display:block;width:min(185px,44vw);aspect-ratio:1.35/1;margin:0 auto 8px;background:url('https://files.catbox.moe/o21pdr.png') center/contain no-repeat!important;}",
      "html body #totpLoginModal .totp-modal::before{background-image:url('https://files.catbox.moe/qcmyad.png')!important;}",
      "html body #telegramLinkCodeModal .security-code-modal::before{background-image:url('https://files.catbox.moe/qimq9x.png')!important;}",
      "html body #transferTotpModal .transfer-totp-modal::before,html body .zconfirm-overlay .zconfirm-modal::before{background-image:url('https://files.catbox.moe/m6mfdt.png')!important;}",
      "html body .security-code-modal h3,html body .totp-modal h3,html body .transfer-totp-modal h3{margin:0!important;color:var(--otp-text)!important;font-size:clamp(26px,5.8vw,38px)!important;line-height:1.12!important;font-weight:900!important;letter-spacing:0!important;text-align:center!important;}",
      "html body .security-code-modal p,html body .totp-modal p,html body .transfer-totp-modal p,html body #telegramLinkCodeSubtitle,html body #totpLoginSubtitle,html body #transferTotpSubtitle{max-width:390px!important;margin:0 auto!important;color:var(--otp-muted)!important;font-size:clamp(16px,3.5vw,21px)!important;line-height:1.5!important;font-weight:800!important;text-align:center!important;}",
      "html body #telegramLinkCodeError,html body #totpLoginError,html body #transferTotpError{min-height:22px!important;color:#ef4444!important;font-size:clamp(13px,2.6vw,16px)!important;font-weight:800!important;line-height:1.4!important;}",
      "html body .otp-hidden-input{position:absolute!important;opacity:0!important;width:1px!important;height:1px!important;pointer-events:none!important;}",
      "html body .otp-slot-row{display:grid!important;grid-template-columns:repeat(6,clamp(42px,11vw,62px))!important;gap:clamp(7px,2vw,12px)!important;justify-content:center!important;direction:ltr!important;width:auto!important;max-width:100%!important;margin:12px auto 22px!important;}",
      "html body .otp-slot-row span{width:clamp(42px,11vw,62px)!important;height:clamp(48px,12vw,62px)!important;border:2px solid var(--otp-line)!important;border-radius:14px!important;background:var(--otp-box)!important;color:var(--otp-text)!important;display:grid!important;place-items:center!important;font-size:clamp(21px,5vw,30px)!important;font-weight:900!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;box-shadow:none!important;}",
      "html body .otp-slot-row span.is-active{border-color:var(--otp-accent)!important;background:rgba(var(--site-accent-rgb,148,163,184),.14)!important;box-shadow:none!important;}html body .otp-slot-row span.is-filled{border-color:rgba(var(--site-accent-rgb,148,163,184),.72)!important;box-shadow:none!important;}",
      "html body .security-code-actions,html body .totp-modal-actions,html body .transfer-totp-actions{width:100%!important;display:grid!important;grid-template-columns:1fr!important;gap:10px!important;margin-top:2px!important;}",
      "html body .security-btn,html body #totpLoginConfirm,html body #transferTotpConfirm,html body #telegramLinkCodeSubmit,html body #totpLoginEmailBtn,html body #totpLoginLostBtn,html body #transferTotpRequestBtn{width:100%!important;min-height:52px!important;border-radius:16px!important;border:1px solid transparent!important;background:var(--otp-btn)!important;color:var(--otp-btn-text)!important;font-size:clamp(15px,3.2vw,18px)!important;font-weight:900!important;line-height:1.25!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;text-align:center!important;white-space:normal!important;padding:0 16px!important;}",
      "html body .modal.unified-otp-modal :is(.security-code-actions,.totp-actions),html body #totpLoginModal .totp-actions,html body #securityEmailCodeModal .security-code-actions,html body #telegramLinkCodeModal .security-code-actions{width:min(100%,420px)!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:12px!important;margin-top:clamp(22px,5vh,46px)!important;}",
      "html body .modal.unified-otp-modal :is(.security-btn,#telegramLinkCodeSubmit,#securityEmailCodeSubmit,#totpLoginConfirm,#totpLoginEmailBtn,#totpLoginLostBtn),html body #totpLoginModal :is(.btn-primary,.totp-email-btn,.totp-lost-btn),html body #securityEmailCodeModal :is(.security-btn,.btn-primary),html body #telegramLinkCodeModal :is(.security-btn,.btn-primary){width:100%!important;min-height:56px!important;border-radius:16px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;padding:0 18px!important;font-weight:900!important;box-shadow:none!important;filter:none!important;}",
      "html body #totpLoginEmailBtn[style*='display: none'],html body #totpLoginEmailBtn[style*='display:none'],html body #totpLoginLostBtn[style*='display: none'],html body #totpLoginLostBtn[style*='display:none'],html body #transferTotpRequestBtn[style*='display: none'],html body #transferTotpRequestBtn[style*='display:none'],html body .security-btn[style*='display: none'],html body .security-btn[style*='display:none']{display:none!important;}",
      "html body .security-btn.ghost,html body .security-btn.neutral,html body #totpLoginLostBtn,html body #totpLoginEmailBtn,html body #transferTotpRequestBtn{background:transparent!important;border-color:var(--otp-line)!important;color:var(--otp-text)!important;}",
      "html body .security-btn:disabled,html body #totpLoginConfirm:disabled,html body #transferTotpConfirm:disabled,html body #telegramLinkCodeSubmit:disabled{background:#bebfc6!important;border-color:#bebfc6!important;color:#fff!important;opacity:1!important;}",
      "html body .security-close,html body .modal-close,html body .totp-close{position:absolute!important;top:14px!important;right:14px!important;left:auto!important;inset-inline-start:auto!important;inset-inline-end:14px!important;width:42px!important;height:42px!important;border:0!important;background:transparent!important;color:transparent!important;font-size:0!important;line-height:1!important;display:grid!important;place-items:center!important;}",
      "html body .security-close::before,html body .modal-close::before,html body .totp-close::before{content:\"\\2192\"!important;color:var(--otp-text)!important;font-size:32px!important;font-weight:900!important;line-height:1!important;}",
      "html body .zconfirm-overlay{position:fixed!important;inset:0!important;z-index:200001!important;background:var(--otp-page-bg,#fff)!important;backdrop-filter:none!important;display:grid!important;place-items:center!important;padding:0!important;overflow:auto!important;}",
      "html body .zconfirm-overlay .zconfirm-modal{width:min(100%,520px)!important;min-height:100vh!important;margin:0 auto!important;padding:34px clamp(20px,5vw,34px) 28px!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--otp-text)!important;box-shadow:none!important;}",
      "html body .zconfirm-overlay .zconfirm-modal::before{content:\"\"!important;display:block!important;width:min(180px,42vw)!important;aspect-ratio:1.35/1!important;margin:0 auto 14px!important;background:url('https://files.catbox.moe/m6mfdt.png') center/contain no-repeat!important;}",
      "html body .zconfirm-title{font-size:clamp(24px,5vw,34px)!important;line-height:1.25!important;color:var(--site-accent-runtime-strong,var(--site-accent-runtime,var(--accent-theme,#5c5ebf)))!important;text-align:center!important;margin:0 0 22px!important;font-weight:900!important;}",
      "html body .zconfirm-row{grid-template-columns:minmax(0,1fr) minmax(86px,130px)!important;font-size:clamp(14px,2.8vw,18px)!important;padding:10px 0!important;color:var(--site-accent-runtime-strong,var(--site-accent-runtime,var(--accent-theme,#5c5ebf)))!important;}",
      "html body .zconfirm-overlay :is(.zconfirm-label,.zlabel,.zvalue,.zfx){color:var(--site-accent-runtime-strong,var(--site-accent-runtime,var(--accent-theme,#5c5ebf)))!important;}html[data-theme='dark'] body .zconfirm-overlay :is(.zconfirm-title,.zconfirm-row,.zconfirm-label,.zlabel,.zvalue,.zfx),html body.dark-mode .zconfirm-overlay :is(.zconfirm-title,.zconfirm-row,.zconfirm-label,.zlabel,.zvalue,.zfx){color:var(--site-accent-runtime-light,var(--site-accent-runtime,var(--accent-theme,#9c9ede)))!important;}html body .zconfirm-actions button{min-height:54px!important;border-radius:14px!important;font-size:clamp(15px,3vw,18px)!important;font-weight:900!important;}",
      "html body .zconfirm-overlay .zrow{grid-template-columns:auto minmax(0,1fr)!important;direction:rtl!important;gap:18px!important;}html body .zconfirm-overlay .zlabel{text-align:right!important;}html body .zconfirm-overlay .zvalue{text-align:left!important;}",
      "html body .zconfirm-overlay .zbtn-primary{background:linear-gradient(135deg,var(--site-accent-runtime,var(--accent-theme,#5c5ebf)),var(--site-accent-runtime-strong,var(--accent-theme,#4a4cc4)))!important;border-color:transparent!important;color:#fff!important;filter:brightness(1.03) saturate(1.05)!important;}html body .zconfirm-overlay .zbtn:not(.zbtn-primary),html body .zconfirm-overlay .zbtn:not(.zbtn-primary):hover,html body .zconfirm-overlay .zbtn:not(.zbtn-primary):focus,html body .zconfirm-overlay .zbtn:not(.zbtn-primary):focus-visible{background:linear-gradient(135deg,var(--site-accent-runtime,var(--accent-theme,#5c5ebf)),var(--site-accent-runtime-strong,var(--accent-theme,#4a4cc4)))!important;border:0!important;color:#fff!important;outline:0!important;box-shadow:none!important;}",
      "html,body{max-width:100%!important;overflow-x:hidden!important;}",
      "html body .modal.unified-otp-modal:not(.hidden),html body .transfer-modal-backdrop.unified-otp-modal:not(.hidden){position:fixed!important;inset:0!important;display:grid!important;place-items:start center!important;align-items:start!important;justify-items:center!important;overflow-y:auto!important;overflow-x:hidden!important;background:var(--otp-page-bg,#fff)!important;padding:clamp(26px,6vh,70px) 12px 28px!important;box-sizing:border-box!important;}",
      "html body .modal.unified-otp-modal:not(.hidden):has(.security-code-modal){padding:0!important;place-items:stretch center!important;}",
      "html body .modal.unified-otp-modal:not(.hidden):has(.totp-modal){padding:0!important;place-items:stretch center!important;}",
      "html body .modal.unified-otp-modal .security-code-modal,html body .modal.unified-otp-modal .totp-modal,html body .transfer-modal-backdrop.unified-otp-modal .transfer-modal.transfer-totp-modal{width:min(100%,460px)!important;max-width:calc(100vw - 24px)!important;min-height:auto!important;margin:0 auto!important;padding:clamp(18px,3.2vh,30px) clamp(16px,5vw,28px) 18px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;box-sizing:border-box!important;overflow:visible!important;gap:10px!important;}",
      "html body .modal.unified-otp-modal .security-code-modal{width:100vw!important;max-width:100vw!important;min-height:100dvh!important;margin:0!important;padding:clamp(18px,3.2vh,34px) max(16px,env(safe-area-inset-right)) 18px max(16px,env(safe-area-inset-left))!important;background:var(--otp-page-bg,#fff)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;}",
      "html body .modal.unified-otp-modal .totp-modal,html body #totpLoginModal .modal-content.totp-modal{width:100vw!important;max-width:100vw!important;min-height:100dvh!important;margin:0!important;padding:clamp(18px,3.2vh,34px) max(16px,env(safe-area-inset-right)) 18px max(16px,env(safe-area-inset-left))!important;background:var(--otp-page-bg,#fff)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;box-sizing:border-box!important;}",
      "html body .modal.unified-otp-modal .security-code-modal > :not(.security-close),html body .modal.unified-otp-modal .security-code-modal .otp-slot-row,html body .modal.unified-otp-modal .security-code-modal .security-code-actions,html body .modal.unified-otp-modal .totp-modal > :not(.totp-close),html body .modal.unified-otp-modal .totp-modal .otp-slot-row,html body .modal.unified-otp-modal .totp-modal .totp-actions,html body #totpLoginModal .modal-content.totp-modal > :not(.totp-close),html body #totpLoginModal .modal-content.totp-modal .otp-slot-row,html body #totpLoginModal .modal-content.totp-modal .totp-actions{width:min(100%,420px)!important;}",
      "html body .modal.unified-otp-modal .security-code-modal::before,html body .modal.unified-otp-modal .totp-modal::before,html body .transfer-modal-backdrop.unified-otp-modal .transfer-totp-modal::before{width:min(190px,48vw)!important;aspect-ratio:1.35/1!important;margin:0 auto 10px!important;flex:0 0 auto!important;}",
      "html body .modal.unified-otp-modal .security-code-modal h3,html body .modal.unified-otp-modal .totp-modal h3,html body .transfer-modal-backdrop.unified-otp-modal .transfer-totp-modal h3{font-size:clamp(23px,5.6vw,32px)!important;line-height:1.15!important;margin:0!important;}",
      "html body .modal.unified-otp-modal .security-code-modal p,html body .modal.unified-otp-modal .totp-modal p,html body .transfer-modal-backdrop.unified-otp-modal .transfer-totp-modal p{font-size:clamp(14px,3.5vw,18px)!important;line-height:1.42!important;max-width:390px!important;}",
      "html body #telegramLinkCodeInput.otp-hidden-input,html body #securityEmailCodeInput.otp-hidden-input,html body #securityOtp.otp-hidden-input,html body #transferTotpInput.otp-hidden-input,html body #totpLoginInput.otp-hidden-input{position:absolute!important;opacity:0!important;width:1px!important;max-width:1px!important;height:1px!important;min-height:1px!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;letter-spacing:0!important;pointer-events:none!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;}",
      "html body .otp-slot-row{width:100%!important;max-width:390px!important;grid-template-columns:repeat(6,minmax(38px,1fr))!important;gap:clamp(6px,1.8vw,10px)!important;margin:8px auto 12px!important;box-sizing:border-box!important;overflow:visible!important;}",
      "html body .otp-slot-row span{width:100%!important;max-width:56px!important;justify-self:center!important;height:clamp(44px,11vw,56px)!important;border-radius:14px!important;font-size:clamp(19px,4.8vw,27px)!important;box-shadow:none!important;}",
      "html body .modal.unified-otp-modal .otp-slot-row span.is-active,html body .modal.unified-otp-modal .otp-slot-row span.is-filled,html body .transfer-modal-backdrop.unified-otp-modal .otp-slot-row span.is-active,html body .transfer-modal-backdrop.unified-otp-modal .otp-slot-row span.is-filled{box-shadow:none!important;}",
      "html body .modal.unified-otp-modal :is(.security-btn,#telegramLinkCodeSubmit,#securityEmailCodeSubmit,#totpLoginConfirm,#transferTotpConfirm),html body #telegramLinkCodeModal :is(.security-btn,.btn-primary),html body #securityEmailCodeModal :is(.security-btn,.btn-primary),html body #totpLoginModal :is(.security-btn,.btn-primary),html body #transferTotpModal :is(.security-btn,.btn-primary){box-shadow:none!important;filter:none!important;transform:none!important;}",
      "html body .security-btn i,html body .totp-email-btn i,html body .totp-lost-btn i,html body #totpLoginEmailBtn i,html body #totpLoginLostBtn i,html body #transferTotpRequestBtn i{display:inline-flex!important;align-items:center!important;}",
      "html body .modal.unified-otp-modal :is(.security-code-actions,.totp-actions),html body #totpLoginModal .totp-actions,html body #securityEmailCodeModal .security-code-actions,html body #telegramLinkCodeModal .security-code-actions{gap:10px!important;margin-top:8px!important;}html body .modal.unified-otp-modal :is(.security-btn,#telegramLinkCodeSubmit,#securityEmailCodeSubmit,#totpLoginConfirm,#totpLoginEmailBtn,#totpLoginLostBtn),html body #totpLoginModal :is(.btn-primary,.totp-email-btn,.totp-lost-btn),html body #securityEmailCodeModal :is(.security-btn,.btn-primary),html body #telegramLinkCodeModal :is(.security-btn,.btn-primary){min-height:50px!important;color:var(--otp-btn-text,#fff)!important;}html body .modal.unified-otp-modal :is(#totpLoginEmailBtn,#totpLoginLostBtn,#transferTotpRequestBtn,.security-btn.ghost,.security-btn.neutral){color:var(--otp-text)!important;}",
      "html body .security-close,html body .modal-close,html body .totp-close{top:12px!important;right:12px!important;left:auto!important;inset-inline-start:auto!important;inset-inline-end:12px!important;width:38px!important;height:38px!important;color:transparent!important;font-size:0!important;}",
      "html body .security-close::before,html body .modal-close::before,html body .totp-close::before{content:\"\\2192\"!important;color:var(--otp-text)!important;font-size:30px!important;font-weight:900!important;line-height:1!important;}",
      "@media(max-width:480px){html body .modal.unified-otp-modal:not(.hidden),html body .transfer-modal-backdrop.unified-otp-modal:not(.hidden){padding-top:22px!important;}html body .modal.unified-otp-modal .security-code-modal,html body .modal.unified-otp-modal .totp-modal,html body .transfer-modal-backdrop.unified-otp-modal .transfer-modal.transfer-totp-modal{max-width:calc(100vw - 18px)!important;padding-inline:12px!important;}html body .otp-slot-row{max-width:370px!important;gap:7px!important;}html body .otp-slot-row span{height:50px!important;max-width:54px!important;}}",
      "html body .modal.unified-otp-modal:not(.hidden):has(.totp-modal),html body .modal.unified-otp-modal:not(.hidden):has(.security-code-modal){padding:0!important;align-items:stretch!important;justify-items:stretch!important;place-items:stretch!important;}",
      "html body #totpLoginModal.modal.unified-otp-modal:not(.hidden),html body #securityEmailCodeModal.modal.unified-otp-modal:not(.hidden),html body #telegramLinkCodeModal.modal.unified-otp-modal:not(.hidden){padding:0!important;align-items:stretch!important;justify-items:stretch!important;place-items:stretch!important;background:var(--otp-page-bg,#fff)!important;}",
      "html body .modal.unified-otp-modal .totp-modal,html body .modal.unified-otp-modal .security-code-modal,html body #totpLoginModal .modal-content.totp-modal,html body #securityEmailCodeModal .modal-content.security-code-modal,html body #telegramLinkCodeModal .modal-content.security-code-modal{width:100vw!important;max-width:100vw!important;min-height:100dvh!important;margin:0!important;}",
      "html body #totpLoginModal #totpLoginLostBtn[style*=\"display: none\"],html body #totpLoginModal #totpLoginEmailBtn[style*=\"display: none\"],html body #securityEmailCodeModal #securityEmailCodeResend[style*=\"display: none\"],html body .modal.unified-otp-modal :is(#totpLoginLostBtn,#totpLoginEmailBtn,#securityEmailCodeResend,#securityEnableRequestBtn,.totp-lost-btn,.totp-email-btn)[style*=\"display: none\"]{display:none!important;}"
    ].join("");
    document.head.appendChild(style);
  }
  // Maps each known OTP input to the confirm button it should light up when the
  // code is complete. Overridable per-input via data-otp-confirm.
  var CONFIRM_BUTTON_BY_INPUT = {
    telegramLinkCodeInput: "telegramLinkCodeSubmit",
    securityEmailCodeInput: "securityEmailCodeSubmit",
    securityOtp: "securityEnableBtn",
    transferTotpInput: "transferTotpConfirm",
    totpLoginInput: "totpLoginConfirm"
  };
  var SCAN_INPUT_IDS = ["telegramLinkCodeInput", "securityEmailCodeInput", "securityOtp", "transferTotpInput", "totpLoginInput"];
  function normalizeDigits(value, length){
    var max = Math.max(1, Math.min(12, Math.trunc(Number(length) || 6)));
    return String(value || "").replace(/\D/g, "").slice(0, max);
  }
  function resolveOtpLength(input, explicit){
    var raw = (explicit != null && explicit !== "")
      ? explicit
      : (input && (input.dataset.otpLength || input.getAttribute("maxlength")));
    var n = Math.trunc(Number(raw) || 0);
    return (n >= 1 && n <= 12) ? n : 6;
  }
  function resolveConfirmButton(input, explicit){
    var id = explicit || (input && (input.dataset.otpConfirm || CONFIRM_BUTTON_BY_INPUT[input.id]));
    return id ? document.getElementById(id) : null;
  }
  function enhanceInput(input, options){
    options = options || {};
    if (!input || input.dataset.otpSlots === "1") return null;
    input.dataset.otpSlots = "1";
    input.classList.add("otp-hidden-input");
    var len = resolveOtpLength(input, options.length);
    var confirmBtn = resolveConfirmButton(input, options.confirmButton);
    if (confirmBtn) confirmBtn.classList.add("otp-confirm-btn");
    function getConfirmBtn(){
      // Confirm button may be rendered slightly after the input; resolve lazily.
      if (!confirmBtn) {
        confirmBtn = resolveConfirmButton(input, options.confirmButton);
        if (confirmBtn) confirmBtn.classList.add("otp-confirm-btn");
      }
      return confirmBtn;
    }
    var row = document.createElement("div");
    row.className = "otp-slot-row";
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-label", "رمز التحقق من " + len + " أرقام");
    for (var i = 0; i < len; i += 1) {
      row.appendChild(document.createElement("span"));
    }
    if (input.parentNode) input.parentNode.insertBefore(row, input.nextSibling);
    var wasComplete = false;
    function sync(){
      var code = normalizeDigits(input.value, len);
      if (input.value !== code) input.value = code;
      var activeIndex = document.activeElement === input ? Math.min(code.length, len - 1) : -1;
      Array.prototype.forEach.call(row.children, function(cell, index){
        cell.textContent = code[index] || "";
        cell.classList.toggle("is-filled", !!code[index]);
        cell.classList.toggle("is-active", index === activeIndex);
      });
      var complete = code.length === len;
      var btn = getConfirmBtn();
      // Visual completion cue only: never touch disabled/loading state here.
      // Inline `!important` so the lighter look wins over the OTP modal's
      // `box-shadow:none!important` / `filter:none!important` rules regardless of
      // selector specificity. An inset white overlay lightens any base color
      // (dark navy or accent gradient) without destroying the button's design.
      if (btn) {
        btn.classList.toggle("otp-complete", complete);
        if (complete) {
          // Complete = the site's dynamic accent (clearly lighter/active); empty/partial
          // stays the button's dark base. Inline !important beats the modal's forced
          // button background rules regardless of selector specificity.
          btn.style.setProperty("background-image", "linear-gradient(135deg, var(--site-accent-runtime, var(--accent-theme, #5c5ebf)), var(--site-accent-runtime-strong, var(--accent-theme, #4a4cc4)))", "important");
          btn.style.setProperty("background-color", "var(--site-accent-runtime, var(--accent-theme, #5c5ebf))", "important");
          btn.style.setProperty("filter", "brightness(1.05) saturate(1.06)", "important");
        } else {
          btn.style.removeProperty("background-image");
          btn.style.removeProperty("background-color");
          btn.style.removeProperty("filter");
        }
      }
      if (typeof options.onChange === "function") {
        try { options.onChange(code, complete); } catch (_) {}
      }
      if (complete && !wasComplete && typeof options.onComplete === "function") {
        try { options.onComplete(code); } catch (_) {}
      }
      wasComplete = complete;
    }
    row.addEventListener("click", function(){ try { input.focus(); } catch (_) {} });
    row.addEventListener("keydown", function(ev){
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        try { input.focus(); } catch (_) {}
      }
    });
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    input.addEventListener("focus", sync);
    input.addEventListener("blur", sync);
    sync();
    return { input: input, row: row, length: len, confirmButton: confirmBtn, sync: sync };
  }
  function scan(){
    ensureStyle();
    document.querySelectorAll(".modal, .transfer-modal-backdrop").forEach(function(modal){
      if (modal.querySelector(".security-code-modal,.totp-modal,.transfer-totp-modal")) {
        modal.classList.add("unified-otp-modal");
      }
    });
    SCAN_INPUT_IDS.forEach(function(id){
      enhanceInput(document.getElementById(id));
    });
  }
  // Public, reusable API. Differences between OTP forms come purely from options
  // (length, confirmButton, onChange, onComplete) or per-input data-* attributes.
  window.OtpForm = {
    enhance: enhanceInput,
    scan: scan,
    normalizeDigits: normalizeDigits,
    confirmButtonByInput: CONFIRM_BUTTON_BY_INPUT,
    inputIds: SCAN_INPUT_IDS
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  try {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
})();
