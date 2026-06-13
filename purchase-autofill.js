/* Source: purchase-autofill.js */
/*
 * Purchase text autofill parser.
 *
 * Parses free-form purchase text (typed or pasted, Arabic or English) into
 * values for the purchase-form fields that the catalog purchase modal renders
 * dynamically (player id / account fields, quantity, etc.).
 *
 * Pure module: no DOM access, no timers, no globals mutated besides the
 * export. Loaded in the browser bundle as `window.PurchaseAutofill` and in
 * Node tests via CommonJS `require`.
 *
 * Money safety: price/total values found in the text are surfaced under
 * `extras` for display/diagnostic purposes only. They are NEVER computed,
 * summed or mapped onto form fields by this module; server-side validation
 * remains authoritative.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === "object") {
    try { root.PurchaseAutofill = api; } catch (_) {}
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";

  var ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
  var EXT_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

  // Convert Arabic-Indic and extended (Persian/Urdu) digits to ASCII, and the
  // Arabic decimal/thousands separators to their ASCII equivalents.
  function normalizeDigits(value) {
    var text = String(value == null ? "" : value);
    if (!text) return "";
    text = text.replace(/[٠-٩]/g, function (d) { return String(ARABIC_INDIC.indexOf(d)); });
    text = text.replace(/[۰-۹]/g, function (d) { return String(EXT_ARABIC_INDIC.indexOf(d)); });
    text = text.replace(/٫/g, ".").replace(/٬/g, ",");
    return text;
  }

  // Lowercase + strip Arabic diacritics/tatweel, unify alef/yaa/teh-marbuta
  // variants, drop separators. Used only for matching labels, never values.
  function normalizeLabel(value) {
    var text = normalizeDigits(String(value == null ? "" : value)).toLowerCase();
    text = text.replace(/[ً-ٰٟـ]/g, "");
    text = text.replace(/[آأإ]/g, "ا");
    text = text.replace(/ى/g, "ي");
    text = text.replace(/ة/g, "ه");
    text = text.replace(/^(?:ال)/, "");
    text = text.replace(/[\s_\-./\\#*()\[\]{}؟?!:؛;،,'"`]+/g, "");
    return text;
  }

  function trimValue(value) {
    return String(value == null ? "" : value)
      .replace(/[​-‏‪-‮﻿]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // End-trim only: keeps internal tabs intact so table-like rows can still be
  // split into label/value during pair extraction.
  function trimSegment(value) {
    return String(value == null ? "" : value)
      .replace(/[​-‏‪-‮﻿]/g, "")
      .replace(/^\s+|\s+$/g, "");
  }

  // Normalize a phone-like value: unify digits, strip grouping characters,
  // convert a leading 00 to +. Returns "" when it does not look like a phone.
  function normalizePhone(value) {
    var text = normalizeDigits(trimValue(value));
    if (!text) return "";
    var plus = /^\s*\+/.test(text);
    var digits = text.replace(/[^\d]/g, "");
    if (!digits) return "";
    if (!plus && /^00\d{6,}/.test(digits)) {
      digits = digits.slice(2);
      plus = true;
    }
    if (digits.length < 5 || digits.length > 16) return "";
    return (plus ? "+" : "") + digits;
  }

  // Parse a numeric token (integer or decimal) out of a value; returns null
  // when the value is not cleanly numeric.
  function parseNumericValue(value) {
    var text = normalizeDigits(trimValue(value));
    if (!text) return null;
    text = text.replace(/[,\s ]/g, "");
    var m = /^([+-]?\d+(?:\.\d+)?)(?:[^\d.].*)?$/.exec(text);
    if (!m) return null;
    var num = Number(m[1]);
    return Number.isFinite(num) ? num : null;
  }

  // Built-in synonym groups. Field defs from the catalog (label/key) always
  // take precedence; these only widen matching for common wordings.
  var SYNONYM_GROUPS = {
    playerId: [
      "player id", "playerid", "player", "uid", "user id", "userid", "id",
      "game id", "gameid", "account id", "accountid", "char id", "character id",
      "ايدي", "آيدي", "أيدي", "الايدي", "ايدي اللاعب", "ايدي الحساب",
      "معرف", "معرف اللاعب", "معرف الحساب", "رقم اللاعب", "رقم الحساب",
      "حساب", "الحساب", "يوزر", "اليوزر"
    ],
    account: [
      "account", "username", "user name", "user", "login", "email", "mail",
      "بريد", "البريد", "ايميل", "الايميل", "اسم المستخدم", "المستخدم", "تسجيل الدخول"
    ],
    name: ["name", "full name", "اسم", "الاسم", "اسم الزبون", "اسم العميل"],
    phone: [
      "phone", "phone number", "mobile", "whatsapp", "tel", "telephone",
      "هاتف", "الهاتف", "رقم الهاتف", "جوال", "الجوال", "رقم الجوال",
      "موبايل", "الموبايل", "واتساب", "رقم واتساب"
    ],
    server: ["server", "server id", "سيرفر", "السيرفر", "سرفر", "خادم"],
    zone: ["zone", "zone id", "زون", "الزون", "منطقة", "المنطقة"],
    quantity: ["quantity", "qty", "count", "كمية", "الكمية", "عدد", "العدد", "كميه"],
    price: ["price", "unit price", "سعر", "السعر", "سعر الوحدة"],
    total: ["total", "grand total", "اجمالي", "الاجمالي", "المجموع", "مجموع", "اجمالي المبلغ", "المبلغ"],
    product: [
      "product", "service", "item", "package", "bundle", "offer", "game",
      "منتج", "المنتج", "خدمة", "الخدمة", "باقة", "الباقة", "عرض", "العرض", "اللعبة", "لعبة"
    ],
    provider: ["provider", "supplier", "مزود", "المزود", "موزع", "الموزع"],
    category: ["category", "section", "فئة", "الفئة", "قسم", "القسم", "تصنيف", "التصنيف"]
  };

  var GROUP_KEYS = Object.keys(SYNONYM_GROUPS);

  var NORMALIZED_GROUPS = (function () {
    var out = {};
    GROUP_KEYS.forEach(function (group) {
      out[group] = SYNONYM_GROUPS[group].map(normalizeLabel).filter(Boolean);
    });
    return out;
  })();

  function classifyLabel(normalized) {
    if (!normalized) return "";
    // Exact synonym match first, then containment for compound labels like
    // "player id (uid)" — longer synonyms checked first to keep precision.
    for (var i = 0; i < GROUP_KEYS.length; i += 1) {
      var group = GROUP_KEYS[i];
      if (NORMALIZED_GROUPS[group].indexOf(normalized) >= 0) return group;
    }
    var best = "";
    var bestLen = 0;
    GROUP_KEYS.forEach(function (group) {
      NORMALIZED_GROUPS[group].forEach(function (syn) {
        if (syn.length >= 2 && syn.length > bestLen && normalized.indexOf(syn) >= 0) {
          best = group;
          bestLen = syn.length;
        }
      });
    });
    return best;
  }

  function classifyFieldDef(field) {
    if (!field) return "";
    if (field.isPlayerId === true) return "playerId";
    var byKey = classifyLabel(normalizeLabel(field.key));
    var byLabel = classifyLabel(normalizeLabel(field.label));
    // playerId beats account/name when both texts disagree, because catalog
    // primary fields are id-like by construction.
    if (byKey === "playerId" || byLabel === "playerId") return "playerId";
    return byLabel || byKey || "";
  }

  // Split raw text into candidate "label/value" segments. Newlines are hard
  // separators; commas and semicolons (Arabic + Latin) split within a line.
  // Tabs and dashes are handled later during pair extraction so hyphenated
  // values and copied table rows survive.
  function splitSegments(text) {
    var raw = String(text == null ? "" : text);
    if (!raw) return [];
    return raw
      .split(/\r\n|\r|\n|[;؛]|[,،](?=\s*[^\d\s])/)
      .map(trimSegment)
      .filter(Boolean);
  }

  function isUsableLabel(label) {
    if (!label) return false;
    // Reject "labels" that are digit-only (e.g. phone numbers "07-12345").
    return !/^[\d\s+()]+$/.test(normalizeDigits(label));
  }

  // Extract a label/value pair from one segment.
  // ":" and "=" are explicit separators and accept any label text.
  // Tab and dash separators are ambiguous (table rows vs hyphenated values),
  // so they only count when `labelKnown` recognizes the left side.
  function extractPair(segment, labelKnown) {
    var known = typeof labelKnown === "function" ? labelKnown : function () { return false; };
    var m = /^\s*([^:=]{1,60}?)\s*[:=]\s*(.+)$/.exec(segment);
    if (m) {
      var label = trimValue(m[1]);
      var value = trimValue(m[2]);
      if (label && value && isUsableLabel(label)) return { label: label, value: value };
      return null;
    }
    m = /^\s*(.{1,60}?)\t+\s*(.+)$/.exec(segment);
    if (m) {
      var tabLabel = trimValue(m[1]);
      var tabValue = trimValue(m[2]);
      if (tabLabel && tabValue && isUsableLabel(tabLabel) && known(tabLabel)) {
        return { label: tabLabel, value: tabValue };
      }
      return null;
    }
    // Dash separators: try each dash position; accept the first whose left
    // side is a recognized label ("ايدي - 123", "qty-5"), so values like
    // "ABC-123" stay intact.
    var dashRe = /[-–—]/g;
    var hit;
    while ((hit = dashRe.exec(segment)) !== null) {
      var left = trimValue(segment.slice(0, hit.index));
      var right = trimValue(segment.slice(hit.index + 1));
      if (left && right && isUsableLabel(left) && known(left)) {
        return { label: left, value: right };
      }
    }
    return null;
  }

  function looksLikeBareIdentifier(text) {
    var v = normalizeDigits(trimValue(text));
    if (!v) return false;
    if (/\s/.test(v)) return false;
    if (v.length < 3 || v.length > 64) return false;
    return /^[\w@.+#-]+$/.test(v);
  }

  function sanitizeForGroup(group, value) {
    var v = trimValue(value);
    if (!v) return "";
    if (group === "phone") {
      var phone = normalizePhone(v);
      return phone || normalizeDigits(v);
    }
    if (group === "quantity") {
      var num = parseNumericValue(v);
      if (num == null || num <= 0 || !Number.isInteger(num)) return "";
      return String(num);
    }
    return normalizeDigits(v);
  }

  /**
   * Parse purchase text against the form's field definitions.
   *
   * @param {string} text   Raw typed/pasted text.
   * @param {Array}  fields Catalog field defs: { key, label, isPlayerId?, kind?, options? }.
   * @returns {{
   *   values: Object<string,string>,   // fieldKey -> sanitized value (labeled matches only, plus bare-id fallback)
   *   labeled: Object<string,boolean>, // fieldKey -> true when the text explicitly labeled this value
   *   quantity: number|null,           // explicit quantity found in the text (integer > 0)
   *   extras: Object<string,string>,   // informational only: price/total/product/provider/category…
   *   matchedAny: boolean
   * }}
   */
  function parsePurchaseText(text, fields) {
    var defs = Array.isArray(fields) ? fields.filter(Boolean) : [];
    var result = { values: {}, labeled: {}, quantity: null, extras: {}, matchedAny: false };
    var raw = String(text == null ? "" : text);
    if (!trimValue(raw)) return result;

    // Field lookup tables: by exact normalized label/key, and by group.
    var byExact = {};
    var byGroup = {};
    defs.forEach(function (field) {
      if (!field || field.key == null) return;
      var keyNorm = normalizeLabel(field.key);
      var labelNorm = normalizeLabel(field.label);
      if (keyNorm && !(keyNorm in byExact)) byExact[keyNorm] = field;
      if (labelNorm && !(labelNorm in byExact)) byExact[labelNorm] = field;
      var group = classifyFieldDef(field);
      if (group && !(group in byGroup)) byGroup[group] = field;
    });

    var segments = splitSegments(raw);
    var unlabeled = [];
    var labelKnown = function (label) {
      var norm = normalizeLabel(label);
      if (!norm) return false;
      if (norm in byExact) return true;
      return !!classifyLabel(norm);
    };

    segments.forEach(function (segment) {
      var pair = extractPair(segment, labelKnown);
      if (!pair) {
        unlabeled.push(segment);
        return;
      }
      var labelNorm = normalizeLabel(pair.label);
      var group = classifyLabel(labelNorm);
      var field = byExact[labelNorm] || (group ? byGroup[group] : null);

      if (field) {
        var fieldGroup = classifyFieldDef(field) || group;
        var value = sanitizeForGroup(fieldGroup, pair.value);
        if (value) {
          result.values[field.key] = value;
          result.labeled[field.key] = true;
          result.matchedAny = true;
        }
        return;
      }
      if (group === "quantity") {
        var qty = parseNumericValue(pair.value);
        if (qty != null && qty > 0 && Number.isInteger(qty)) {
          result.quantity = qty;
          result.matchedAny = true;
        }
        return;
      }
      if (group) {
        var extraValue = group === "price" || group === "total"
          ? normalizeDigits(pair.value)
          : trimValue(pair.value);
        if (extraValue) {
          result.extras[group] = extraValue;
          result.matchedAny = true;
        }
      }
      // Unknown labels are ignored on purpose: never guess money or
      // unrelated values into purchase fields.
    });

    // Bare value fallback: a single unlabeled identifier maps to the primary
    // (player id) field when that field did not already get a labeled value.
    if (unlabeled.length === 1 && segments.length === unlabeled.length) {
      var primary = byGroup.playerId || defs[0] || null;
      if (primary && primary.key != null && !(primary.key in result.values) && looksLikeBareIdentifier(unlabeled[0])) {
        var bare = normalizeDigits(trimValue(unlabeled[0]));
        if (bare) {
          result.values[primary.key] = bare;
          result.matchedAny = true;
        }
      }
    }

    return result;
  }

  /**
   * Decide which controls to fill, without touching the DOM.
   *
   * @param {Object} parsed Result of parsePurchaseText.
   * @param {Array} states  One per text control:
   *   { key, value, autofilled?:boolean, manualEdit?:boolean }
   *   - autofilled: the current value came from a previous autofill
   *   - manualEdit: the user edited the control after the last autofill
   * @param {Object} [opts] { source: "paste"|"input" }
   * @returns {Array<{key:string, value:string}>} controls to update.
   */
  function planAutofill(parsed, states, opts) {
    var actions = [];
    if (!parsed || !parsed.values) return actions;
    var list = Array.isArray(states) ? states : [];
    list.forEach(function (state) {
      if (!state || state.key == null) return;
      var key = String(state.key);
      if (!(key in parsed.values)) return;
      var next = String(parsed.values[key] == null ? "" : parsed.values[key]);
      if (!next) return;
      var current = trimValue(state.value);
      if (current === next) return;
      var labeled = parsed.labeled && parsed.labeled[key] === true;
      if (!current) {
        actions.push({ key: key, value: next });
        return;
      }
      if (state.manualEdit === true && !labeled) return;
      if (state.manualEdit !== true && state.autofilled !== true && !labeled) return;
      actions.push({ key: key, value: next });
    });
    return actions;
  }

  return {
    parsePurchaseText: parsePurchaseText,
    planAutofill: planAutofill,
    normalizeDigits: normalizeDigits,
    normalizeLabel: normalizeLabel,
    normalizePhone: normalizePhone,
    parseNumericValue: parseNumericValue,
    splitSegments: splitSegments
  };
});
