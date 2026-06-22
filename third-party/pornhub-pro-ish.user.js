// ==UserScript==
// @name         Pornhub Pro-ish
// @namespace    https://www.reddit.com/user/Alpacinator
// @version      7.3.1
// @include      *://*.pornhub.com/*
// @grant        none
// @run-at       document-start
// @description  Adds a menu with to apply filters, add sorting, player tweaks like hiding the cursor and auto-mute, and site-wide quality-of-life improvements like automatic age verification and always default to the english version of the site. Beta download button added! Actively maintained and used by me so updated regularly. Feel free to request features!
// @downloadURL https://update.sleazyfork.org/scripts/473397/Pornhub%20Pro-ish.user.js
// @updateURL https://update.sleazyfork.org/scripts/473397/Pornhub%20Pro-ish.meta.js
// ==/UserScript==

(function() {
	'use strict';

	// ===========================================================================
	// PORNHUB PRO-ISH — Architecture overview
	//
	// Everything runs inside a single IIFE to avoid polluting the global scope.
	//
	// Execution order on page load:
	//   1. CrossDomainStorage  — cookie-based storage shared across subdomains
	//   2. AgeGate.run()       — immediately bypass the age disclaimer if enabled
	//   3. CONFIG              — central constants (timings, selectors, etc.)
	//   4. handleError / Utils — shared helpers used by every class
	//   5. EventEmitter        — pub/sub bus that decouples classes from each other
	//   6. StateManager        — persists boolean settings via CrossDomainStorage
	//   7. Feature             — plain data descriptor for each menu toggle
	//   8. AutoScroller        — fetches and appends playlist pages automatically
	//   9. VideoSorter         — re-orders video items by duration, award, or views
	//  10. VideoHider          — hides items matching active filter rules
	//  11. VideoPlayer         — mute helper and cursor-hide CSS injection
	//  12. DownloadManager     — injects a download button into the player
	//  13. LanguageManager     — forces the site to load in English
	//  14. ElementHider        — removes persistent site clutter (banners etc.)
	//  15. PlaylistManager     — adds delete-confirmation overlay on playlist items
	//  16. ScrollToTop         — smooth scroll helper
	//  17. MenuManager         — builds and manages the floating UI panel
	//  18. App                 — wires everything together; runs the DOM observer
	//  19. initializeApp()     — entry point called at the bottom
	//
	// Communication between classes goes through the EventEmitter (pub/sub).
	// Persistent settings are stored via CrossDomainStorage (cookies) and
	// read/written through StateManager, which also caches values in memory.
	// ===========================================================================

	// ---------------------------------------------------------------------------
	// CrossDomainStorage
	//
	// A localStorage-compatible API (getItem / setItem / removeItem) that stores
	// values as cookies scoped to the root domain (e.g. ".pornhub.com") so that
	// settings saved on www.pornhub.com are automatically visible on nl, de, fr,
	// and every other subdomain.
	//
	// On first access of a key, any existing localStorage value is migrated into
	// a cookie automatically so users don't lose their previous settings.
	//
	// Falls back to plain localStorage if cookie writes fail for any reason.
	//
	// NOTE: the root-domain extraction uses `parts.slice(-2)`, which is correct
	// for a single TLD label like `.com`. If this helper is ever reused on a
	// site with a two-label TLD like `.co.uk`, that logic must be updated.
	// ---------------------------------------------------------------------------

	const CrossDomainStorage = (() => {
		// Strip the subdomain to get the root domain with a leading dot,
		// which is required for cookies to be shared across all subdomains.
		// e.g. "nl.pornhub.com" → ".pornhub.com"
		const _rootDomain = (() => {
			const parts = window.location.hostname.split('.');
			return '.' + parts.slice(-2).join('.');
		})();

		const COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60; // 10 years

		function _readAllCookies() {
			const map = {};
			document.cookie.split('; ').forEach(pair => {
				const idx = pair.indexOf('=');
				if (idx < 0) return;
				const k = pair.slice(0, idx).trim();
				const v = pair.slice(idx + 1).trim();
				if (k) map[k] = v;
			});
			return map;
		}

		return {
			// Returns the stored string for `key`, or null if not found.
			// Checks cookies first; if missing, checks localStorage and migrates
			// the value into a cookie so it's shared cross-subdomain going forward.
			getItem(key) {
				try {
					const cookies = _readAllCookies();
					if (Object.prototype.hasOwnProperty.call(cookies, key)) {
						return decodeURIComponent(cookies[key]);
					}
					// Migrate from localStorage if present
					const lsVal = localStorage.getItem(key);
					if (lsVal !== null) {
						this.setItem(key, lsVal);
						localStorage.removeItem(key);
						return lsVal;
					}
					return null;
				} catch (err) {
					try {
						return localStorage.getItem(key);
					} catch (_) {
						return null;
					}
				}
			},

			// Writes `value` as a root-domain cookie that persists for 10 years.
			// Falls back to localStorage if cookie writing fails.
			setItem(key, value) {
				try {
					const encoded = encodeURIComponent(String(value));
					document.cookie = [
						`${key}=${encoded}`,
						`domain=${_rootDomain}`,
						'path=/',
						`max-age=${COOKIE_MAX_AGE}`,
						'SameSite=Lax',
					].join('; ');
				} catch (err) {
					try {
						localStorage.setItem(key, String(value));
					} catch (_) {}
				}
			},

			// Expires the cookie on both root domain and current subdomain,
			// then also removes any localStorage entry for the same key.
			removeItem(key) {
				try {
					document.cookie = [
						`${key}=`,
						`domain=${_rootDomain}`,
						'path=/',
						'max-age=0',
						'SameSite=Lax',
					].join('; ');
					// Also clear any plain subdomain cookie that may have existed
					document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
				} catch (err) {}
				try {
					localStorage.removeItem(key);
				} catch (_) {}
			},
		};
	})();

	// ---------------------------------------------------------------------------
	// AgeGate
	//
	// Manages the age-verification cookie the site checks before showing content.
	// When "Auto-confirm age" is enabled, this sets the cookie so the disclaimer
	// never appears.
	//
	// Because the script runs at document-start, the cookie is set before the
	// page's HTML starts parsing. If the cookie was missing, run() sets it and
	// reloads once — the server then sees the cookie on the reload and never
	// sends the age gate. A sessionStorage flag prevents an infinite reload loop.
	// ---------------------------------------------------------------------------
	class AgeGate {
		static _COOKIE_KEY = 'accessAgeDisclaimerPH';
		static _COOKIE_VALUE = '2';
		static _COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60; // 10 years in seconds

		// Records whether the cookie was absent the first time the script looked
		// (i.e. at document-start). If so, the server served this page WITHOUT the
		// cookie — meaning the age gate page — so a reload is needed once the
		// cookie has been set. Captured once and read later by reloadIfNeeded().
		static _servedWithoutCookie = false;
		static _initialCheckDone = false;

		static _CONSENT_KEY = 'cookieConsent';
		static _CONSENT_VALUE = '3';

		// Writes the age-gate acceptance cookie. Sets it on both the root domain
		// (.pornhub.com, shared across subdomains) and the bare host, since the
		// site may read either. Also sets cookieConsent=2 if absent or set to 1.
		// Returns true if the cookie is present afterwards.
		static set() {
			const parts = window.location.hostname.split('.');
			const rootDomain = '.' + parts.slice(-2).join('.');

			const base = [
				`${AgeGate._COOKIE_KEY}=${AgeGate._COOKIE_VALUE}`,
				'path=/',
				`max-age=${AgeGate._COOKIE_MAX_AGE}`,
				'SameSite=Lax',
			];

			document.cookie = [...base, `domain=${rootDomain}`].join('; ');
			document.cookie = base.join('; ');

			// Set cookieConsent=2 if missing or currently 1 (partial/rejected consent).
			const existingConsent = document.cookie
				.split('; ')
				.find(c => c.startsWith(`${AgeGate._CONSENT_KEY}=`))
				?.split('=')[1];
			if (existingConsent === undefined || existingConsent === '1') {
				const consentBase = [
					`${AgeGate._CONSENT_KEY}=${AgeGate._CONSENT_VALUE}`,
					'path=/',
					`max-age=${AgeGate._COOKIE_MAX_AGE}`,
					'SameSite=Lax',
				];
				document.cookie = [...consentBase, `domain=${rootDomain}`].join('; ');
				document.cookie = consentBase.join('; ');
				console.log(`AgeGate: ${AgeGate._CONSENT_KEY} set to ${AgeGate._CONSENT_VALUE} (was: ${existingConsent ?? 'absent'})`);
			}

			console.log('AgeGate: cookie set');
			return AgeGate.exists();
		}

		// Returns true if the age-gate cookie is already present.
		static exists() {
			return document.cookie
				.split('; ')
				.some(c => c.startsWith(`${AgeGate._COOKIE_KEY}=`));
		}

		// Called as early as possible (document-start). Captures whether the
		// cookie was missing when the page was served, then sets it so it's
		// ready for the next request. Does NOT reload here — a reload during
		// early document parse is unreliable; reloadIfNeeded() handles that later.
		static run() {
			// Capture the initial cookie state unconditionally, BEFORE the enabled
			// check. At document-start the setting cookie may not exist yet (the
			// 'true' default is only persisted later by StateManager), so gating
			// this capture behind the enabled check would miss it entirely.
			if (!AgeGate._initialCheckDone) {
				AgeGate._initialCheckDone = true;
				AgeGate._servedWithoutCookie = !AgeGate.exists();
			}

			// Treat a missing setting as enabled, since the feature default is true.
			// Only an explicit 'false' disables it.
			const enabled = CrossDomainStorage.getItem('autoConfirmAgeState') !== 'false';
			if (!enabled) return;

			if (!AgeGate.exists()) {
				AgeGate.set();
			}
		}

		// WHAT: Reloads the page once if the cookie was missing when this page was
		//       served (so the age gate was shown) and the setting is enabled.
		// WHERE: Called from App.init(), after the DOM is ready, where reload works
		//        reliably.
		// WHY: Setting the cookie alone doesn't dismiss an already-served gate page;
		//      the server only honours the cookie on the next request. The
		//      sessionStorage guard prevents an infinite reload loop if the cookie
		//      never sticks (e.g. blocked cookies or a changed cookie name).
		static reloadIfNeeded() {
			// Match run()'s semantics: missing setting counts as enabled (default true).
			const enabled = CrossDomainStorage.getItem('autoConfirmAgeState') !== 'false';
			if (!enabled) return;

			if (!AgeGate._servedWithoutCookie) {
				// Page was served with the cookie already present — no gate, no reload.
				sessionStorage.removeItem('ageGateReloaded');
				return;
			}

			// Make sure the cookie is actually set before reloading.
			if (!AgeGate.exists() && !AgeGate.set()) {
				console.warn('AgeGate: cookie could not be set; skipping reload');
				return;
			}

			if (!sessionStorage.getItem('ageGateReloaded')) {
				sessionStorage.setItem('ageGateReloaded', 'true');
				console.log('AgeGate: reloading to clear the age gate');
				location.reload();
			} else {
				console.warn('AgeGate: already reloaded once this session; not reloading again');
			}
		}

		// Removes the age-gate cookie and reloads so the disclaimer reappears.
		// Called when the user disables "Auto-confirm age" in the menu.
		static clear() {
			const parts = window.location.hostname.split('.');
			const rootDomain = '.' + parts.slice(-2).join('.');
			// Expire on both the root domain and the bare host to fully clear it.
			document.cookie = `${AgeGate._COOKIE_KEY}=; domain=${rootDomain}; path=/; max-age=0; SameSite=Lax`;
			document.cookie = `${AgeGate._COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
			console.log('AgeGate: cookie cleared');
			sessionStorage.removeItem('ageGateReloaded');
			location.reload();
		}
	}
	// Runs at document-start: captures whether the page was served without the
	// cookie and sets the cookie immediately. The actual reload (if needed) is
	// deferred to App.init via AgeGate.reloadIfNeeded(), where it's reliable.
	AgeGate.run();

	// ---------------------------------------------------------------------------
	// CONFIG
	//
	// Central place for all magic numbers, CSS selectors, and named constants.
	//
	// OPACITY   — transparency levels for the "Enable transparency" toggle.
	// TIMING    — delays and thresholds used across multiple classes.
	// LIMITS    — size/count caps unrelated to timing.
	// SORT      — valid values for the unified sort-mode dropdown.
	// SELECTORS — CSS selectors targeting site elements. Update here if the
	//             site's markup changes and features stop working.
	// ---------------------------------------------------------------------------

	const CONFIG = {
		SCRIPT_NAME: 'PH-PRO',
		// Three distinct values so the hover effect is visible while transparency
		// is enabled (TRANSPARENT < HOVER < DEFAULT).
		OPACITY: {
			TRANSPARENT: 0.70,
			HOVER: 0.85,
			DEFAULT: 1.0,
		},
		// Resting background colour for the menu's action buttons (sort + scroll).
		// When transparency is on, buttons use a darker semi-transparent tint than
		// the menu panel (which sits at rgba(0,0,0,0.3)) so they still stand out
		// against the blurred background. When off, they're solid black.
		BUTTON_BG: {
			TRANSPARENT: 'rgba(0,0,0,0.45)',
			SOLID: 'black',
		},
		TIMING: {
			MUTATION_DEBOUNCE_MS: 300,
			LANGUAGE_CHECK_DELAY_MS: 1000,
			CURSOR_HIDE_DELAY_S: 3,
			AUTOSCROLL_MIN_DELAY_MS: 800,
			AUTOSCROLL_MAX_DELAY_MS: 2500,
			AUTOSCROLL_MAX_CONSECUTIVE_EMPTY: 3,
			BUTTON_FLASH_MS: 100,
			OBSERVER_THROTTLE_MS: 1000,
			FEATURE_INIT_DELAY_MS: 100,
			SLIDE_MS: 280, // menu panel slide-in/out animation duration
			TOUCH: {
				// px from the screen edge that qualifies as an edge-swipe gesture
				EDGE_THRESHOLD_PX: 30,
				// minimum horizontal travel (px) before a swipe is recognised
				SWIPE_MIN_PX: 60,
			},
			ELEMENT_HIDE_LOAD_DELAY_MS: 500,
			DOWNLOAD_BUTTON_DELAY_MS: 4000,
			BUTTON_FADE_DELAY_MS: 5000,  // ms after page load before menu button fades (swipe-to-open only)
		},
		LIMITS: {
			// Maximum length of the combined comma-separated filter words string
			// stored in a cookie. Keeps the cookie under typical 4KB cookie limits.
			FILTER_WORDS_MAX_LENGTH: 255,
		},
		SORT: {
			VALID_MODES: ['none', 'duration', 'award', 'views'],
		},
		SELECTORS: {
			VIDEO_LISTS: 'ul.videos, ul.videoList',
			WATCHED_INDICATORS: '.watchedVideoText, .watchedVideo',
			PAID_CONTENT: 'span.price, .premiumicon, img.privateOverlay',
			VR_INDICATOR: 'span.vr-thumbnail',
			SHORTS_SECTION: '#shortiesListSection',
			MUTE_BUTTON: 'div.mgp_volume[data-text="Mute"]',
			LANGUAGE_DROPDOWN: 'li.languageDropdown',
			ENGLISH_OPTION: 'li[data-lang="en"] a.networkTab',
			FULLSCREEN_BUTTON: '.mgp_fullscreen',
			DOWNLOAD_BUTTON_ID: 'phpro-download-btn',
			PLAYLIST_CONTAINERS: [
				'#videoPlaylist',
				'#videoPlaylistSection',
				'#playListSection',
				'[id*="playlist"]',
				'[class*="playlist"]',
				'[data-context="playlist"]',
			],
			ELEMENTS_TO_HIDE: [
				'#countryRedirectMessage',
				'#js-abContainterMain',
				'#welcome',
				'div.pornInLangWrapper',
				'#loadMoreRelatedVideosCenter',
				'[data-label="recommended_load_more"]',
				'.buttonClass.blackBtn.eudsaLink',
        '#cookieBanner',
        '.cbShort',
			],
		},
	};

	// ---------------------------------------------------------------------------
	// handleError
	//
	// Centralised logger used throughout the script. Prefixes every message with
	// the script name and calling context so console output is easy to filter.
	// `level` can be 'warn' (non-fatal) or 'error' (unexpected failure).
	// ---------------------------------------------------------------------------

	function handleError(context, error, level = 'error') {
		const message = error instanceof Error ? error.message : String(error);
		const prefix = `${CONFIG.SCRIPT_NAME} [${context}]:`;
		if (level === 'warn') {
			console.warn(prefix, message, error);
		} else {
			console.error(prefix, message, error);
		}
	}

	// ---------------------------------------------------------------------------
	// Utils
	//
	// Stateless helper functions shared across the whole script.
	// ---------------------------------------------------------------------------

	const Utils = {
		// Prefixed console wrapper. Use instead of bare console.log so all
		// script output is groupable and filterable in DevTools.
		log(message, level = 'info') {
			const prefix = `${CONFIG.SCRIPT_NAME}:`;
			if (level === 'error') console.error(prefix, message);
			else if (level === 'warn') console.warn(prefix, message);
			else console.log(prefix, message);
		},

		// Returns a version of `func` that delays execution until `wait` ms have
		// passed since the last call. Useful for batching rapid DOM mutations.
		debounce(func, wait) {
			let timeout;
			return function(...args) {
				clearTimeout(timeout);
				timeout = setTimeout(() => func.apply(this, args), wait);
			};
		},

		// Returns a version of `func` that fires at most once per `limit` ms.
		// The first call fires immediately; subsequent calls within the window are
		// dropped. Used for the MutationObserver callback.
		throttle(func, limit) {
			let inThrottle = false;
			return function(...args) {
				if (!inThrottle) {
					func.apply(this, args);
					inThrottle = true;
					setTimeout(() => {
						inThrottle = false;
					}, limit);
				}
			};
		},

		// Converts "HH:MM:SS" or "MM:SS" to total seconds.
		// Returns 0 for invalid input so sorting still works gracefully.
		parseDuration(durationString) {
			if (!durationString || typeof durationString !== 'string') return 0;
			const parts = durationString.trim().split(':').map(Number);
			return parts.reduce((acc, part) => (isNaN(part) ? acc : acc * 60 + part), 0);
		},

		// Creates a DOM element and applies an options object to it.
		// Handles style (object), textContent, className, dataset, and any other
		// property via setAttribute.
		createElement(tag, options = {}) {
			const element = document.createElement(tag);
			for (const [key, value] of Object.entries(options)) {
				try {
					if (key === 'style' && typeof value === 'object') {
						Object.assign(element.style, value);
					} else if (key === 'textContent') {
						element.textContent = value;
					} else if (key === 'className') {
						element.className = value;
					} else if (key === 'dataset' && typeof value === 'object') {
						Object.assign(element.dataset, value);
					} else {
						element.setAttribute(key, value);
					}
				} catch (err) {
					handleError(`createElement(${tag}).${key}`, err, 'warn');
				}
			}
			return element;
		},

		// querySelector with try/catch — returns null instead of throwing on
		// invalid selectors (which can happen if the site changes its markup).
		safeQuerySelector(selector, context = document) {
			try {
				return context.querySelector(selector);
			} catch (err) {
				handleError(`safeQuerySelector("${selector}")`, err, 'warn');
				return null;
			}
		},

		// querySelectorAll with try/catch — returns [] instead of throwing.
		safeQuerySelectorAll(selector, context = document) {
			try {
				return Array.from(context.querySelectorAll(selector));
			} catch (err) {
				handleError(`safeQuerySelectorAll("${selector}")`, err, 'warn');
				return [];
			}
		},

		// Splits a comma-separated filter string into a cleaned array of words.
		// Trims whitespace, lowercases, removes empty entries, and enforces the
		// max-length cap from CONFIG to prevent oversized cookie values.
		sanitizeFilterWords(input) {
			if (!input || typeof input !== 'string') return [];
			const clamped = input.slice(0, CONFIG.LIMITS.FILTER_WORDS_MAX_LENGTH);
			return clamped
				.split(',')
				.map(w => w.trim().toLowerCase())
				.filter(w => w.length >= 1);
		},

		// Returns the saved sort mode, validated against CONFIG.SORT.VALID_MODES.
		// Falls back to 'none' if storage holds an unexpected value.
		// Migrates the legacy 'trophy' value (renamed to 'award') so users who saved
		// it before the rename keep their setting.
		getValidSortMode() {
			let raw = CrossDomainStorage.getItem('sortModeState') ?? 'none';
			if (raw === 'trophy') {
				raw = 'award';
				CrossDomainStorage.setItem('sortModeState', raw);
			}
			return CONFIG.SORT.VALID_MODES.includes(raw) ? raw : 'none';
		},

		// Injects a <style> tag into <head> and returns the element.
		addStylesheet(css) {
			const style = Utils.createElement('style', {
				textContent: css
			});
			document.head.appendChild(style);
			return style;
		},
	};

	// ---------------------------------------------------------------------------
	// EventEmitter
	//
	// Minimal publish/subscribe system used to decouple classes from each other.
	// Instead of classes calling each other directly, they emit named events and
	// subscribe to events they care about.
	//
	// Example: MenuManager emits 'hideVideos' when a filter toggle changes.
	//          App listens for 'hideVideos' and calls VideoHider.hideVideos().
	//          VideoHider never needs to know MenuManager exists.
	// ---------------------------------------------------------------------------

	class EventEmitter {
		constructor() {
			this._events = new Map();
		}

		on(event, callback) {
			if (!this._events.has(event)) this._events.set(event, []);
			this._events.get(event).push(callback);
		}

		off(event, callback) {
			if (!this._events.has(event)) return;
			this._events.set(event, this._events.get(event).filter(cb => cb !== callback));
		}

		emit(event, data) {
			if (!this._events.has(event)) return;
			for (const callback of this._events.get(event)) {
				try {
					callback(data);
				} catch (err) {
					handleError(`EventEmitter.emit("${event}")`, err);
				}
			}
		}

		removeAllListeners() {
			this._events.clear();
		}
	}

	// ---------------------------------------------------------------------------
	// StateManager
	//
	// Single source of truth for all boolean feature flags (toggle states).
	// Wraps CrossDomainStorage with an in-memory cache so repeated reads within
	// a single page load don't hit the cookie jar every time.
	//
	// Validators (registered via addValidator) enforce that values are the correct
	// type before they're persisted. Invalid writes are rejected.
	//
	// Emits a 'stateChanged' event on the EventEmitter whenever a value changes,
	// so other parts of the script can react automatically.
	// ---------------------------------------------------------------------------

	class StateManager {
		constructor(eventEmitter) {
			this._cache = new Map();
			this._eventEmitter = eventEmitter;
			this._validators = new Map();
		}

		addValidator(key, validator) {
			this._validators.set(key, validator);
		}

		// Read a boolean setting. Returns `defaultValue` if the key has never been
		// set. On first read the value is also written back to storage to persist
		// the default so it exists next time.
		get(key, defaultValue = false) {
			if (this._cache.has(key)) return this._cache.get(key);

			try {
				const raw = CrossDomainStorage.getItem(key);
				const value = raw !== null ? raw === 'true' : defaultValue;
				const validated = this._validate(key, value, defaultValue);
				if (raw === null) this._persist(key, validated);
				this._cache.set(key, validated);
				return validated;
			} catch (err) {
				handleError(`StateManager.get("${key}")`, err);
				return defaultValue;
			}
		}

		// Write a boolean setting. Validates, updates storage and cache, then
		// emits 'stateChanged' if the value actually changed.
		set(key, value, emit = true) {
			try {
				const validated = this._validate(key, value, value);
				if (validated !== value) {
					Utils.log(`StateManager: invalid value for "${key}": ${value}`, 'warn');
					return false;
				}
				const oldValue = this._cache.get(key);
				this._persist(key, value);
				this._cache.set(key, value);
				if (emit && oldValue !== value) {
					this._eventEmitter.emit('stateChanged', {
						key,
						oldValue,
						newValue: value
					});
				}
				return true;
			} catch (err) {
				handleError(`StateManager.set("${key}")`, err);
				return false;
			}
		}

		// Flips a boolean setting and returns the new value.
		toggle(key) {
			const newValue = !this.get(key);
			this.set(key, newValue);
			return newValue;
		}

		// Drops the in-memory cache so the next get() re-reads from storage.
		// Called when the tab becomes visible again in case another tab changed a setting.
		clearCache() {
			this._cache.clear();
		}

		_validate(key, value, fallback) {
			const validator = this._validators.get(key);
			if (!validator) return value;
			return validator(value) ? value : fallback;
		}

		_persist(key, value) {
			CrossDomainStorage.setItem(key, String(value));
		}
	}

	// ---------------------------------------------------------------------------
	// Feature
	//
	// Plain data object describing a single toggle in the menu.
	//   label        — text shown next to the toggle switch
	//   key          — StateManager key used to persist the on/off state
	//   handler      — optional function called after the state changes
	//   id           — DOM id of the toggle track element
	//   defaultState — initial value if the key has never been set
	//   category     — groups related features under a header in the menu
	// ---------------------------------------------------------------------------

	class Feature {
		constructor({
			label,
			key,
			handler,
			id,
			defaultState = false,
			category = 'general',
		}) {
			this.label = label;
			this.key = key;
			this.handler = handler || (() => {});
			this.id = id;
			this.defaultState = defaultState;
			this.category = category;
		}
	}

	// ---------------------------------------------------------------------------
	// AutoScroller
	//
	// Automatically loads all pages of a playlist by fetching each chunk from
	// the site's internal API and appending results to the visible list, avoiding
	// the need to manually click "Load more" repeatedly.
	//
	// Flow:
	//   start()      → works out the starting page from items already loaded
	//                → emits 'autoscrollStateChanged' so App can pause the observer
	//                → kicks off _scheduleNext(0) immediately
	//   _scrollLoop() → fetches one page → deduplicates → appends items
	//                → scrolls new items into view → schedules the next fetch
	//                → stops after N consecutive pages with no new videos
	//   stop()       → emits 'autoscrollStateChanged'
	//                → App resumes the observer and scrolls to the top
	// ---------------------------------------------------------------------------

	class AutoScroller {
		constructor(eventEmitter) {
			this._eventEmitter = eventEmitter;
			this.isRunning = false;
			this._timeoutId = null;
			this._playlistPage = null;
			this._fetchedPages = null;
		}

		// Starts autoscrolling. Calculates the starting page from the number of
		// <li> items already on screen (each page holds 32 items).
		start() {
			if (this.isRunning) {
				Utils.log('AutoScroll already running');
				return false;
			}
			this.isRunning = true;
			this._playlistPage = Math.floor(
				document.querySelectorAll('ul.videos.row-5-thumbs li').length / 32
			) + 1;
			this._fetchedPages = new Set();
			this._consecutiveEmpty = 0;
			this._retriedCurrentPage = false;
			Utils.log('AutoScroll started');
			this._eventEmitter.emit('autoscrollStateChanged', {
				isRunning: true
			});
			this._scheduleNext(0);
			return true;
		}

		// Stops autoscrolling and clears the pending timeout.
		stop() {
			if (!this.isRunning) return false;
			this.isRunning = false;
			if (this._timeoutId) {
				clearTimeout(this._timeoutId);
				this._timeoutId = null;
			}
			Utils.log('AutoScroll stopped');
			this._eventEmitter.emit('autoscrollStateChanged', {
				isRunning: false
			});
			return true;
		}

		// Convenience method used by the menu button.
		toggle() {
			return this.isRunning ? this.stop() : this.start();
		}

		_scheduleNext(delayMs) {
			this._timeoutId = setTimeout(() => this._scrollLoop(), delayMs);
		}

		// WHAT: Fetches one page (~32 videos) of the current playlist from the site's
		//       internal API and appends any genuinely new items to the visible list.
		// WHERE: Scheduled repeatedly by _scheduleNext() with randomised delays while
		//        autoscroll is running.
		// WHY (deduplication): Network retries, overlapping requests, and the site's
		//      own pagination can return videos already on screen. To avoid visible
		//      duplicates we (1) build a Set of every video id already present, (2)
		//      strip any pre-existing duplicates from the DOM, then (3) append only
		//      incoming items whose id isn't in that Set. After several consecutive
		//      pages with no new items, the playlist is treated as exhausted and we stop.
		async _scrollLoop() {
			if (!this.isRunning) return;

			try {
				if (this._fetchedPages.has(this._playlistPage)) {
					Utils.log(`AutoScroll: page ${this._playlistPage} already fetched, skipping`);
					this._playlistPage++;
					this._scheduleNext(0);
					return;
				}

				this._fetchedPages.add(this._playlistPage);

				const id =
					document.querySelector('[data-playlist-id]')?.dataset.playlistId ??
					location.pathname.match(/\/(\d+)$/)?.[1];
				const token = document.querySelector('[data-token]')?.dataset.token;

				const response = await fetch(
					`${location.origin}/playlist/viewChunked?id=${id}&token=${token}&page=${this._playlistPage}`, {
						credentials: 'include',
						headers: {
							'X-Requested-With': 'XMLHttpRequest',
							'Sec-Fetch-Site': 'same-origin',
						},
						method: 'GET',
						mode: 'cors',
					}
				);

				const html = await response.text();
				const list = document.querySelector('ul.videos.row-5-thumbs');

				if (!list) {
					Utils.log('AutoScroll: video list element not found, stopping');
					this.stop();
					return;
				}

				for (const li of list.querySelectorAll('li')) {
					li.style.display = '';
				}

				// Build the id Set and drop any duplicates already in the DOM.
				const existingIds = new Set();
				for (const li of list.querySelectorAll('li[data-video-id]')) {
					const vid = li.dataset.videoId;
					if (existingIds.has(vid)) {
						li.remove();
						Utils.log(`AutoScroll: removed pre-existing duplicate ${vid}`);
					} else {
						existingIds.add(vid);
					}
				}

				const template = document.createElement('template');
				template.innerHTML = html;
				const incoming = Array.from(template.content.querySelectorAll('li[data-video-id]'));
				const duplicates = incoming.filter(li => existingIds.has(li.dataset.videoId)).length;
				if (duplicates > 0) Utils.log(`AutoScroll: skipped ${duplicates} duplicate(s)`);

				const countBefore = list.querySelectorAll('li.pcVideoListItem').length;
				// Track the first item we actually append so we can scroll to it
				// (rather than to a duplicate that was filtered out).
				let firstAppended = null;
				for (const li of incoming) {
					if (!existingIds.has(li.dataset.videoId)) {
						list.appendChild(li);
						if (!firstAppended) firstAppended = li;
					}
				}
				const countAfter = list.querySelectorAll('li.pcVideoListItem').length;

				firstAppended?.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				});
				this._playlistPage++;

				if (countAfter <= countBefore) {
					if (!this._retriedCurrentPage) {
						// First empty result for this page — undo the page increment and
						// retry once before counting it as a genuinely empty response.
						this._retriedCurrentPage = true;
						this._playlistPage--;
						this._fetchedPages.delete(this._playlistPage);
						Utils.log(`AutoScroll: no new items on page ${this._playlistPage + 1}, retrying once`);
						const {
							AUTOSCROLL_MIN_DELAY_MS: min,
							AUTOSCROLL_MAX_DELAY_MS: max
						} = CONFIG.TIMING;
						this._scheduleNext(min + Math.floor(Math.random() * (max - min)));
						return;
					}
					// Already retried — count it as empty and move on.
					this._retriedCurrentPage = false;
					this._consecutiveEmpty++;
					Utils.log(`AutoScroll: no new items after retry (${this._consecutiveEmpty}/${CONFIG.TIMING.AUTOSCROLL_MAX_CONSECUTIVE_EMPTY})`);
					if (this._consecutiveEmpty >= CONFIG.TIMING.AUTOSCROLL_MAX_CONSECUTIVE_EMPTY) {
						Utils.log('AutoScroll: max consecutive empty responses reached, stopping');
						this.stop();
						return;
					}
				} else {
					this._consecutiveEmpty = 0;
					this._retriedCurrentPage = false;
				}
			} catch (err) {
				handleError('AutoScroller._scrollLoop', err);
				const list = document.querySelector('ul.videos.row-5-thumbs');
				const lastLi = list?.querySelector('li:last-child');
				if (lastLi) lastLi.scrollIntoView({
					behavior: 'smooth',
					block: 'end'
				});
				else window.scrollTo(0, document.body.scrollHeight);
			}

			const {
				AUTOSCROLL_MIN_DELAY_MS: min,
				AUTOSCROLL_MAX_DELAY_MS: max
			} = CONFIG.TIMING;
			this._scheduleNext(min + Math.floor(Math.random() * (max - min)));
		}
	}

	// ---------------------------------------------------------------------------
	// VideoSorter
	//
	// Re-orders video <li> items inside video list <ul> elements either by
	// duration (longest first), award status (award-icon items first), or
	// view count (most viewed first).
	//
	// findVideoLists() discovers all video grids on the page and optionally
	// excludes playlist containers, so sorting only affects regular browsing
	// pages unless "Sort within playlists" is enabled.
	// ---------------------------------------------------------------------------

	class VideoSorter {
		constructor(stateManager) {
			this._state = stateManager;
		}

		findVideoLists(includePlaylist = null) {
			const allLists = Utils.safeQuerySelectorAll(CONFIG.SELECTORS.VIDEO_LISTS);
			if (includePlaylist === null) {
				includePlaylist = this._state.get('sortWithinPlaylistsState');
			}
			return allLists.filter(list => {
				const isInPlaylist = CONFIG.SELECTORS.PLAYLIST_CONTAINERS.some(
					sel => list.closest(sel) || list.matches(sel) || list.id.toLowerCase().includes('playlist')
				);
				if (!includePlaylist && isInPlaylist) {
					Utils.log(`VideoSorter: excluding playlist container "${list.id || list.className}"`);
					return false;
				}
				return true;
			});
		}

		findPlaylistLists() {
			return CONFIG.SELECTORS.PLAYLIST_CONTAINERS
				.flatMap(sel => Utils.safeQuerySelectorAll(`${sel} ul.videos`));
		}

		sortByDuration(forceIncludePlaylist = false) {
			const lists = forceIncludePlaylist ? [...new Set([...this.findPlaylistLists(), ...this.findVideoLists(true)])] :
				this.findVideoLists();
			Utils.log(`VideoSorter: sorting ${lists.length} list(s) by duration`);
			lists.forEach(list => this._sortListByDuration(list));
		}

		_sortListByDuration(list) {
			const items = Utils.safeQuerySelectorAll('li', list).filter(li => li.querySelector('.duration'));
			if (items.length === 0) return;
			try {
				items.sort((a, b) => {
					const da = Utils.parseDuration(a.querySelector('.duration')?.textContent ?? '0');
					const db = Utils.parseDuration(b.querySelector('.duration')?.textContent ?? '0');
					return db - da;
				});
				items.forEach(item => list.appendChild(item));
			} catch (err) {
				handleError('VideoSorter._sortListByDuration', err);
			}
		}

		// WHAT: Moves videos that carry an "award-icon" badge to the front of each list.
		// WHERE: Triggered by the "By award" auto-sort mode and the manual award button.
		// WHY: Surfaces award-winning videos first. Matches any element whose class
		//      contains "award-icon" (not only <i> tags) so badge markup variations
		//      are all caught.
		sortByAward(forceIncludePlaylist = false) {
			const lists = forceIncludePlaylist ? [...new Set([...this.findPlaylistLists(), ...this.findVideoLists(true)])] :
				this.findVideoLists();
			Utils.log(`VideoSorter: sorting ${lists.length} list(s) by award`);
			lists.forEach(list => this._sortListByAward(list));
		}

		_sortListByAward(list) {
			const items = Utils.safeQuerySelectorAll('li', list);
			const awarded = items.filter(i => i.querySelector('[class*="award-icon"]'));
			const others = items.filter(i => !i.querySelector('[class*="award-icon"]'));
			Utils.log(`VideoSorter: ${awarded.length} award / ${others.length} other in "${list.id || list.className}"`);
			[...awarded, ...others].forEach(item => list.appendChild(item));
		}

		// Sorts all applicable lists by view count (most viewed first).
		sortByViews(forceIncludePlaylist = false) {
			const lists = forceIncludePlaylist ?
				[...new Set([...this.findPlaylistLists(), ...this.findVideoLists(true)])] :
				this.findVideoLists();
			Utils.log(`VideoSorter: sorting ${lists.length} list(s) by views`);
			lists.forEach(list => this._sortListByViews(list));
		}

		// Parses a view count string like "62.8K", "1.2M", or "945" into a plain number.
		// Handles K (thousands), M (millions), B (billions) suffixes.
		_parseViews(viewString) {
			if (!viewString || typeof viewString !== 'string') return 0;
			const s = viewString.trim().replace(/,/g, '');
			const num = parseFloat(s);
			if (isNaN(num)) return 0;
			if (s.endsWith('K') || s.endsWith('k')) return num * 1_000;
			if (s.endsWith('M') || s.endsWith('m')) return num * 1_000_000;
			if (s.endsWith('B') || s.endsWith('b')) return num * 1_000_000_000;
			return num;
		}

		// Reads the .views var text from each <li> and re-appends in descending order.
		// Items without a views element are treated as 0 and sorted to the bottom.
		_sortListByViews(list) {
			const items = Utils.safeQuerySelectorAll('li', list);
			if (items.length === 0) return;
			try {
				items.sort((a, b) => {
					const va = this._parseViews(a.querySelector('.views var')?.textContent ?? '0');
					const vb = this._parseViews(b.querySelector('.views var')?.textContent ?? '0');
					return vb - va; // descending: most viewed first
				});
				items.forEach(item => list.appendChild(item));
			} catch (err) {
				handleError('VideoSorter._sortListByViews', err);
			}
		}
	}

	// ---------------------------------------------------------------------------
	// VideoHider
	//
	// Hides individual video <li> items matching any active filter:
	//   - Watched videos  (have a watched overlay that isn't also hidden)
	//   - Paid content    (price badge, premium icon, or private overlay)
	//   - VR videos       (have a VR badge)
	//   - Word filters    (title text contains one of the saved filter words)
	//   - Shorts section  (the entire row, hidden as a unit)
	//
	// Operates in two modes:
	//   Full pass   — scans every item in every video list (initial load / toggle)
	//   Incremental — only checks newly added DOM nodes (infinite scroll)
	// ---------------------------------------------------------------------------

	class VideoHider {
		constructor(stateManager, videoSorter) {
			this._state = stateManager;
			this._videoSorter = videoSorter;
			this._cachedFilterWords = null;
			this._lastFilterString = null;
		}

		getFilterWords() {
			const current = CrossDomainStorage.getItem('savedFilterWords') ?? '';
			if (current !== this._lastFilterString) {
				this._lastFilterString = current;
				this._cachedFilterWords = Utils.sanitizeFilterWords(current);
			}
			return this._cachedFilterWords;
		}

		// Returns the show-only word list (videos NOT matching any of these are hidden).
		getShowWords() {
			return Utils.sanitizeFilterWords(CrossDomainStorage.getItem('savedShowWords') ?? '');
		}

		// Main entry point. Reads toggle states then iterates over items,
		// setting display:none or clearing it based on _shouldHide().
		// `addedNodes` limits processing to newly inserted elements (incremental mode).
		hideVideos(addedNodes = null) {
			const hideWatched = this._state.get('hideWatchedState');
			const hidePaid = this._state.get('hidePaidContentState');
			const hideVR = this._state.get('hideVRState');
			const hideShorts = this._state.get('hideShortsState');
			const filterWords = this.getFilterWords();
			const showWords = this.getShowWords();

			const shortsSection = Utils.safeQuerySelector(CONFIG.SELECTORS.SHORTS_SECTION);
			if (shortsSection) {
				shortsSection.style.display = hideShorts ? 'none' : '';
			}

			let items;

			if (addedNodes && addedNodes.length > 0) {
				items = addedNodes.flatMap(node => {
					if (node.nodeType !== Node.ELEMENT_NODE) return [];
					if (node.tagName === 'LI') return [node];
					return Array.from(node.querySelectorAll('li'));
				});
				Utils.log(`VideoHider: incremental pass, ${items.length} new item(s)`);
			} else {
				const lists = this._videoSorter.findVideoLists(true);
				items = lists.flatMap(list => Utils.safeQuerySelectorAll('li', list));
				Utils.log(`VideoHider: full pass, ${items.length} item(s)`);
			}

			for (const item of items) {
				try {
					item.style.display = this._shouldHide(item, {
							hideWatched,
							hidePaid,
							hideVR,
							filterWords,
							showWords
						}) ?
						'none' :
						'';
				} catch (err) {
					handleError('VideoHider.hideVideos (item)', err, 'warn');
				}
			}
		}

		// WHAT: Decides whether a single video item should be hidden.
		// WHERE: Called once per item by hideVideos().
		// WHY (rule order & interaction): Rules are checked cheapest-first and the
		//      method returns true on the first match. The two keyword filters are
		//      independent and both can hide an item:
		//        - filterWords (hide list): hide if the title contains ANY listed word.
		//        - showWords (show-only):   hide if the title contains NONE of them.
		//      So if both lists are populated, an item survives only when it matches a
		//      show word AND matches no hide word.
		_shouldHide(item, {
			hideWatched,
			hidePaid,
			hideVR,
			filterWords,
			showWords
		}) {
			if (hideWatched) {
				const watched = item.querySelector(CONFIG.SELECTORS.WATCHED_INDICATORS);
				if (watched && !watched.classList.contains('hidden')) return true;
			}
			if (hidePaid) {
				const isPaid =
					item.querySelector(CONFIG.SELECTORS.PAID_CONTENT) ||
					item.querySelector('a')?.getAttribute('href') === 'javascript:void(0)';
				if (isPaid) return true;
			}
			if (hideVR && item.querySelector(CONFIG.SELECTORS.VR_INDICATOR)) {
				return true;
			}
			const text = item.textContent.toLowerCase();
			if (filterWords.length > 0) {
				if (filterWords.some(w => text.includes(w))) return true;
			}
			// Show-only: hide anything that doesn't match at least one show word
			if (showWords.length > 0) {
				if (!showWords.some(w => text.includes(w))) return true;
			}
			return false;
		}
	}

	// ---------------------------------------------------------------------------
	// VideoPlayer
	//
	// Static helpers that interact with the video player UI.
	//   mute()             — simulates the full mouse-event sequence on the mute
	//                        button (a plain click() alone doesn't work because
	//                        the player uses custom internal events)
	//   resetMuteState()   — clears the "already muted" guard, called when the
	//                        tab goes to background
	//   toggleCursorHide() — injects/removes a CSS animation that hides the
	//                        cursor after N seconds of inactivity over the video
	// ---------------------------------------------------------------------------

	// WHAT: Player-related helpers — auto-mute and cursor-hiding.
	// WHERE: Called by App on init/visibility change and by Feature handlers.
	// WHY: This is a stateless namespace of utilities (apart from the single
	//      _hasMuted latch), so it's an object literal rather than a class. A class
	//      with only static members is just a namespace with extra ceremony.
	const VideoPlayer = {
		// Latches true after a successful mute so we don't re-fire mute events on
		// every pass; reset by resetMuteState() when the tab is hidden.
		_hasMuted: false,

		// WHAT: Clicks the player's mute control by dispatching the events it listens for.
		// WHY: The site's mute button reacts to a sequence of synthetic mouse events
		//      rather than a single click, so all of them are dispatched in order.
		mute(force = false) {
			if (VideoPlayer._hasMuted && !force) return;

			const buttons = Utils.safeQuerySelectorAll(CONFIG.SELECTORS.MUTE_BUTTON);
			for (const button of buttons) {
				try {
					for (const type of ['mouseover', 'focus', 'mousedown', 'mouseup', 'click']) {
						button.dispatchEvent(new Event(type, {
							bubbles: true,
							cancelable: true
						}));
					}
				} catch (err) {
					handleError('VideoPlayer.mute (button)', err, 'warn');
				}
			}

			if (buttons.length > 0) Utils.log(`VideoPlayer: muted ${buttons.length} player(s)`);
			if (buttons.length > 0) VideoPlayer._hasMuted = true;
		},

		// Clears the mute latch so the next mute() call will fire again.
		resetMuteState() {
			VideoPlayer._hasMuted = false;
		},

		// WHAT: Adds/removes a stylesheet that hides the cursor after N seconds of
		//       hovering a playing video.
		// WHY: Injected as CSS (rather than a JS timer) so the browser handles the
		//      hover timing; toggled live so the change applies without a reload.
		toggleCursorHide(enabled) {
			const STYLE_ID = 'phpro-cursor-hide-style';
			const existing = document.getElementById(STYLE_ID);

			if (enabled && !existing) {
				const style = Utils.createElement('style', {
					id: STYLE_ID,
					textContent: `
                        @keyframes hideCursor {
                          0%, 99% { cursor: default; }
                          100%     { cursor: none; }
                        }
                        .mgp_playingState { animation: none; }
                        .mgp_playingState:hover {
                          animation: hideCursor ${CONFIG.TIMING.CURSOR_HIDE_DELAY_S}s forwards;
                        }
                    `,
				});
				document.head.appendChild(style);
				Utils.log('VideoPlayer: cursor-hide style added');
			} else if (!enabled && existing) {
				existing.remove();
				Utils.log('VideoPlayer: cursor-hide style removed');
			}
		},
	};

	// ---------------------------------------------------------------------------
	// DownloadManager
	//
	// Injects a download button into the video player toolbar so the user can
	// save the highest-quality MP4 directly to their device.
	//
	// Because video URLs are exposed through window.mediaDefinitions (page JS
	// context), the button logic is injected as an inline <script> tag that runs
	// in page context rather than in the userscript sandbox.
	//
	// Click flow inside the injected script:
	//   findVideoUrl()  → reads window.mediaDefinitions → picks best quality
	//                   → if the URL is a remote quality manifest, fetches it
	//                     and picks the highest-quality entry from the list
	//   startDownload() → streams the video with fetch(), shows live progress
	//                     in a toast, collects chunks into a Blob, and triggers
	//                     a download <a> link
	//
	// The button is placed just before the fullscreen button and retried up to
	// 10 times (every 800 ms) in case the player hasn't finished rendering yet.
	//
	// NOTE: the injected script collects the full response into a Blob before
	// triggering the download. For multi-GB videos this can OOM the tab. A
	// future improvement would be to use showSaveFilePicker() (File System
	// Access API) and stream the response directly to disk where supported.
	// ---------------------------------------------------------------------------
	class DownloadManager {
		static _buttonAdded = false;

		// Accepts the stateManager and eventEmitter as explicit dependencies
		// instead of reaching into stateManager._eventEmitter.
		static init(stateManager, eventEmitter) {
			// React to toggle changes from the menu
			eventEmitter.on('stateChanged', ({
				key,
				newValue
			}) => {
				if (key === 'downloadButtonState') {
					if (newValue === true) {
						setTimeout(() => DownloadManager.addButton(), 1500);
					} else {
						DownloadManager.removeButton();
					}
				}
			});

			// Initial load if already enabled
			if (stateManager.get('downloadButtonState', false)) {
				setTimeout(() => DownloadManager.addButton(), CONFIG.TIMING.DOWNLOAD_BUTTON_DELAY_MS);
			}
		}

		static removeButton() {
			document.querySelectorAll('.mgp_button[data-phpro-download]').forEach(b => b.remove());
			DownloadManager._buttonAdded = false;
		}

		static addButton() {
			if (DownloadManager._buttonAdded) return;
			DownloadManager._buttonAdded = true;

			const script = document.createElement('script');
			script.textContent = `
            (function() {
                'use strict';

                function log(msg) {
                    console.log('%c[PH-PRO Download] ' + msg, 'color:#ff9800;font-weight:bold');
                }

                // Strip filesystem-illegal characters and limit length so the
                // download doesn't fail silently on Windows or hit FS limits.
                function sanitizeFilename(name) {
                    return (name || 'video')
                        .replace(/[<>:"/\\\\|?*\\x00-\\x1f]/g, '_')
                        .replace(/\\s+/g, ' ')
                        .trim()
                        .slice(0, 200) || 'video';
                }

                async function findVideoUrl() {
                    log("Searching for mediaDefinitions...");

                    // This is the working method you had
                    const mediaObj = Object.values(window).find(v => v?.mediaDefinitions);
                    let media = mediaObj ? mediaObj.mediaDefinitions : null;

                    if (!media) {
                        log("Fallback: looking for window.mediaDefinitions directly");
                        media = window.mediaDefinitions;
                    }

                    if (!Array.isArray(media) || media.length === 0) {
                        throw new Error("mediaDefinitions not found or empty");
                    }

                    log("Found " + media.length + " media entries");

                    // Try direct mp4 first (non-remote)
                    let videoUrl = media.find(v => v.format === "mp4" && !v.remote)?.videoUrl;

                    if (!videoUrl) {
                        // Remote quality list fallback (very common)
                        const remote = media.find(v => v.remote && v.videoUrl);
                        if (remote) {
                            log("Fetching remote quality list...");
                            const res = await fetch(remote.videoUrl);
                            const list = await res.json();
                            if (Array.isArray(list) && list.length > 0) {
                                list.sort((a, b) => (b.quality || 0) - (a.quality || 0));
                                videoUrl = list[0].videoUrl;
                                log("Using highest quality: " + (list[0].quality || "unknown") + "p");
                            }
                        }
                    }

                    if (!videoUrl) throw new Error("No valid video URL found");
                    return videoUrl;
                }

                function showToast(text) {
                    let toast = document.getElementById('phpro-download-toast');
                    if (!toast) {
                        toast = document.createElement('div');
                        toast.id = 'phpro-download-toast';
                        toast.style.cssText = 'position:fixed;bottom:25px;left:25px;padding:12px 18px;background:rgba(0,0,0,0.92);color:#fff;font-size:14px;border-radius:8px;z-index:2147483647;border:1px solid #ff9800;transition:opacity .3s;';
                        document.body.appendChild(toast);
                    }
                    toast.textContent = text;
                    toast.style.opacity = '1';
                    return toast;
                }

                function hideToast() {
                    const toast = document.getElementById('phpro-download-toast');
                    if (toast) toast.style.opacity = '0';
                    setTimeout(() => toast?.remove(), 400);
                }

                async function startDownload() {
                    const toast = showToast("Finding highest quality stream...");
                    try {
                        const videoUrl = await findVideoUrl();
                        toast.textContent = "Downloading...";

                        const res = await fetch(videoUrl);
                        const reader = res.body.getReader();
                        const total = +res.headers.get('Content-Length') || 0;
                        let received = 0;
                        const chunks = [];

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(value);
                            received += value.length;

                            if (total) {
                                const percent = ((received / total) * 100).toFixed(1);
                                toast.textContent = \`Downloading... \${percent}%\`;
                            } else {
                                toast.textContent = \`Downloading... \${(received / 1024 / 1024).toFixed(1)} MB\`;
                            }
                        }

                        const blob = new Blob(chunks);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const rawTitle = document.title.replace(/- Pornhub\\.com.*/i, '').trim();
                        a.download = sanitizeFilename(rawTitle) + ".mp4";
                        a.click();
                        URL.revokeObjectURL(url);

                        toast.textContent = "Download started ✓";
                        setTimeout(hideToast, 1800);
                    } catch (err) {
                        console.error(err);
                        toast.textContent = "Download failed – check console";
                        setTimeout(hideToast, 3000);
                    }
                }

                // Inject the button
                function injectButton() {
                    document.querySelectorAll('.mgp_button[data-phpro-download]').forEach(b => b.remove());

                    const fullscreenBtn = document.querySelector('.mgp_fullscreen');
                    if (!fullscreenBtn) return false;

                    const btn = document.createElement('div');
                    btn.className = 'mgp_button';
                    btn.dataset.phproDownload = 'true';
                    btn.style.pointerEvents = 'auto';
                    btn.innerHTML = \`
                      <div class="mgp_icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                              <path d="M12 5V19M12 19L5 12M12 19L19 12"
                                    stroke="#ffffff"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"/>
                          </svg>
                      </div>
                    \`;

                    btn.onclick = (e) => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        startDownload();
                    };

                    // Tooltip
                    btn.addEventListener('mouseenter', () => {
                        const original = fullscreenBtn.getAttribute('data-text');
                        fullscreenBtn.setAttribute('data-text', "Download this video");
                        fullscreenBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                        setTimeout(() => fullscreenBtn.setAttribute('data-text', original), 60);
                    });
                    btn.addEventListener('mouseleave', () => {
                        fullscreenBtn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                    });

                    fullscreenBtn.parentNode.insertBefore(btn, fullscreenBtn);
                    log("Download button successfully injected");
                    return true;
                }

                // Try injecting with retries
                let attempts = 0;
                const interval = setInterval(() => {
                    attempts++;
                    if (injectButton() || attempts >= 10) {
                        clearInterval(interval);
                    }
                }, 800);
            })();
        `;

			document.documentElement.appendChild(script);
			script.remove();
		}
	}

	// ---------------------------------------------------------------------------
	// LanguageManager
	//
	// Ensures the site always loads in English when the toggle is on.
	//
	// Strategy (tried in order, after a short delay for the site to settle):
	//   1. Check the 'lang' cookie. If it isn't 'en', overwrite it with 'en'
	//      scoped to the root domain, then redirect to www (dropping any country
	//      subdomain prefix from the hostname).
	//   2. If the cookie is already 'en' but the UI still shows a different
	//      language, click the English option in the language dropdown.
	// ---------------------------------------------------------------------------

	class LanguageManager {
		constructor(stateManager) {
			this._state = stateManager;
		}

		redirectToEnglish() {
			if (!this._state.get('redirectToEnglishState')) return;

			setTimeout(() => {
				try {
					const langCookie = this._getCookie('lang');
					if (langCookie !== 'en') {
						const hostParts = window.location.hostname.split('.');
						const baseDomain = hostParts.slice(-2).join('.');

						this._deleteCookie('lang');
						this._deleteCookie('lang', baseDomain);
						this._setCookie('lang', 'en', 365, baseDomain);

						Utils.log(`LanguageManager: set lang cookie to English for ${baseDomain}, redirecting`);

						const newUrl = `${window.location.protocol}//${baseDomain}${window.location.pathname}${window.location.search}`;
						window.location.href = newUrl;
						return;
					}

					const dropdown = Utils.safeQuerySelector(CONFIG.SELECTORS.LANGUAGE_DROPDOWN);
					const currentLang = dropdown?.querySelector('span.networkTab')?.textContent.trim().toLowerCase();
					if (currentLang !== 'en') {
						const englishLink = Utils.safeQuerySelector(CONFIG.SELECTORS.ENGLISH_OPTION);
						if (englishLink) {
							englishLink.click();
							Utils.log('LanguageManager: redirected to English');
						}
					}
				} catch (err) {
					handleError('LanguageManager.redirectToEnglish', err);
				}
			}, CONFIG.TIMING.LANGUAGE_CHECK_DELAY_MS);
		}

		_getCookie(name) {
			const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
			return match ? decodeURIComponent(match[2]) : null;
		}

		_setCookie(name, value, days, domain) {
			const expires = new Date();
			expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
			const domainPart = domain ? `;domain=${domain}` : '';
			document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/${domainPart}`;
		}

		_deleteCookie(name, domain) {
			const domainPart = domain ? `;domain=${domain}` : '';
			document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${domainPart}`;
		}
	}

	// ---------------------------------------------------------------------------
	// ElementHider
	//
	// Hides persistent UI clutter injected by the site — country-redirect banners,
	// A/B test containers, welcome modals, GDPR notices, etc.
	// Runs once on DOMContentLoaded and again on window load since some elements
	// are injected after the initial HTML parse.
	// ---------------------------------------------------------------------------

	// WHAT: Hides persistent UI clutter injected by the site — country-redirect
	//       banners, A/B test containers, welcome modals, GDPR notices, etc.
	// WHERE: Called by App once on DOMContentLoaded and again on window load.
	// WHY: Some of these elements are injected after the initial HTML parse, so a
	//      single early pass would miss them; running again on load catches the rest.
	//      Implemented as an object literal rather than a static-only class because
	//      it holds no state and is just a namespaced function.
	const ElementHider = {
		hideElements() {
			Utils.log('ElementHider: hiding unwanted elements');
			for (const selector of CONFIG.SELECTORS.ELEMENTS_TO_HIDE) {
				try {
					Utils.safeQuerySelectorAll(selector).forEach(el => {
						el.style.display = 'none';
					});
				} catch (err) {
					handleError(`ElementHider.hideElements("${selector}")`, err, 'warn');
				}
			}
		},
	};

	// ---------------------------------------------------------------------------
	// PlaylistManager
	//
	// Adds a semi-transparent red overlay to playlist items the moment the user
	// clicks the "delete from playlist" button on them. This gives instant visual
	// feedback that the deletion is in progress, since the site takes a moment to
	// actually remove the item from the DOM.
	//
	// Uses event delegation on document so it works even for dynamically-loaded
	// playlist items.
	// ---------------------------------------------------------------------------

	class PlaylistManager {
		init() {
			// WHAT: Listens (via delegation on document) for clicks on a playlist
			//       item's delete button and overlays that item in red.
			// WHERE: Attached once at startup.
			// WHY: Delegation means dynamically-loaded playlist items are covered
			//      without re-binding. closest() is used instead of matches() so a
			//      click landing on an icon *inside* the button still registers.
			document.addEventListener('click', event => {
				const deleteButton = event.target?.closest('button[onclick="deleteFromPlaylist(this);"]');
				if (deleteButton) {
					this._addRedOverlay(deleteButton);
				}
			});
		}

		_addRedOverlay(element) {
			try {
				const parentLi = element.closest('li');
				if (!parentLi) return;

				if (parentLi.querySelector('.phpro-delete-overlay')) return;

				const overlay = Utils.createElement('div', {
					className: 'phpro-delete-overlay',
					style: {
						position: 'absolute',
						top: '0',
						left: '0',
						width: '100%',
						height: '100%',
						backgroundColor: 'red',
						opacity: '0.5',
						pointerEvents: 'none',
						zIndex: '1000',
					},
				});
				parentLi.style.position = 'relative';
				parentLi.appendChild(overlay);
			} catch (err) {
				handleError('PlaylistManager._addRedOverlay', err, 'warn');
			}
		}
	}

	// ---------------------------------------------------------------------------
	// ScrollToTop
	//
	// Simple helper that smoothly scrolls to the top of the page.
	// Extracted into its own class so it can be injected into MenuManager
	// without creating a direct dependency on the window object.
	// ---------------------------------------------------------------------------

	class ScrollToTop {
		scrollToTop() {
			window.scrollTo({
				top: 0,
				behavior: 'smooth'
			});
		}
	}

	// ---------------------------------------------------------------------------
	// MenuManager
	//
	// Builds and manages the floating overlay UI: the draggable "☰ Menu" button
	// and the panel that slides open from it.
	//
	// The panel contains:
	//   - Toggle rows (one per Feature, grouped by category)
	//   - Manual action buttons (sort, autoscroll, scroll-to-top)
	//   - A filter-words input with removable tag chips
	//
	// Button dragging (desktop + mobile):
	//   mousedown/touchstart → record start position and lock button size
	//   mousemove/touchmove  → translate the button via CSS transform (rAF batched)
	//   mouseup/touchend     → snap to the nearest edge if within SNAP_MARGIN px,
	//                          then save the final position to CrossDomainStorage
	//
	//   Drag threshold: 5 px for mouse, 15 px for touch (larger to survive normal
	//   finger wobble without accidentally triggering a drag on a tap).
	//
	//   On mobile, touchend calls e.preventDefault() to suppress the synthetic
	//   'click' the browser fires ~300 ms after a tap — without this, a tap would
	//   open the panel and then immediately close it again.
	//
	// Position persistence:
	//   Stored as distances from the nearest edges (horizontal/vertical) so the
	//   button re-appears in the same relative corner on any viewport size.
	//
	// Accessibility:
	//   Toggle rows expose role="switch" + aria-checked and respond to Enter and
	//   Space when focused. The close button is a real <button> element.
	// ---------------------------------------------------------------------------

	class MenuManager {

		constructor(stateManager, eventEmitter, autoScroller, scrollToTop) {
			this._state = stateManager;
			this._eventEmitter = eventEmitter;
			this._autoScroller = autoScroller;
			this._scrollToTop = scrollToTop;

			this._menu = null;
			this._toggleButton = null;
			this._styleSheet = null;
			this._sections = []; // tracks all collapsible sections for state sync
			// Per-type references to the keyword-filter input + chip container.
			// Populated by _buildFilterBlock(); keyed by filter type ('hide'/'show').
			this._filterRefs = {};
			// Tracks which screen edge last opened the menu via swipe, so the close
			// gesture knows which direction to accept. Null when opened via button.
			this._swipeOpenedFromSide = null;
			this._fadeTimer = null; // timeout ID for the menu-button fade-out (swipe-to-open mode)

			this._features = this._buildFeatureDefinitions();

			this._eventEmitter.on('autoscrollStateChanged', this._onAutoscrollStateChanged.bind(this));
		}

		// Public entry point. Builds all UI elements and appends them to <html>
		// (not <body>, so they survive any body replacements by the site).
		create() {
			Utils.log('MenuManager: creating menu');
			try {
				this._styleSheet = this._addMenuStyles();
				this._menu = this._createMenuContainer();
				this._applyOpacityToMenuAndButton();
				this._applyMenuSide();
				// Anchor the panel below where the floating menu toggle typically
				// sits (top: 12px) so the two don't overlap. This used to live
				// inside _addCloseButton() but is now its own concern.
				this._menu.style.top = '40px';
				// Build each collapsible section. Sorting now contains both the
				// auto-sort dropdown and the manual sort buttons; Filtering contains
				// both the filter toggles and the keyword filter inputs.
				this._addSection('General', 'general');
				this._addSection('Player', 'player');
				this._addSection('Sorting', 'sorting',
					{ position: 'before', fn: c => c.appendChild(this._createSortDropdown()) },
					{ position: 'after', fn: c => this._appendManualSortButtons(c) }
				);
				this._addSection('Filtering', 'filtering',
					{ position: 'after', fn: c => this._populateFilterWords(c) }
				);
				this._addSection('Autoscroll', null,
					{ position: 'after', fn: c => this._appendScrollButtons(c) }
				);
				this._addCloseFooterButton();
				document.documentElement.appendChild(this._menu);
				this._toggleButton = this._createToggleButton();
				document.documentElement.appendChild(this._toggleButton);
				this._scheduleButtonFade();
				this._setupPanelDismiss();
				this._setupTouchHandlers();
			} catch (err) {
				handleError('MenuManager.create', err);
			}
		}

		_addMenuStyles() {
			return Utils.addStylesheet(`
                .phpro-category-header {
                    color: orange;
                    background-color: #1e1e1e;
                    margin: 20px 0 10px;
                    display: block;
                    font-size: 16px;
                    padding: 10px;
                    border-radius: 4px;
                    text-transform: uppercase;
                    border-left: 3px solid transparent;
                }
                .phpro-category-header:first-of-type {
                    margin-top: 0;
                }
                .phpro-section-header {
                    cursor: pointer;
                    user-select: none;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .phpro-section-header:hover {
                    background-color: #2a2a2a;
                }
                /* When transparency is on, the menu gets .phpro-transparent. The
                   section headers get a semi-transparent tint plus a solid orange
                   left border so they're always distinguishable regardless of
                   what colour is behind the menu — a pure black background would
                   make the tint alone invisible. */
                #sideMenu.phpro-transparent .phpro-category-header {
                    background-color: rgba(0,0,0,0.65);
                    border-left-color: orange;
                }
                #sideMenu.phpro-transparent .phpro-section-header:hover {
                    background-color: rgba(0,0,0,0.72);
                }
                /* Orange scrollbar for the menu panel. */
                #sideMenu::-webkit-scrollbar {
                    width: 6px;
                }
                #sideMenu::-webkit-scrollbar-track {
                    background: transparent;
                }
                #sideMenu::-webkit-scrollbar-thumb {
                    background-color: orange;
                    border-radius: 3px;
                }
                #sideMenu {
                    scrollbar-color: orange transparent;
                    scrollbar-width: thin;
                }
                .phpro-section-arrow {
                    font-style: normal;
                    font-size: 13px;
                    transition: transform 0.2s;
                    margin-left: 8px;
                    flex-shrink: 0;
                }
                .phpro-section-content {
                    overflow: hidden;
                }
                .phpro-sort-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    width: 100%;
                    gap: 10px;
                }
                .phpro-sort-row label {
                    color: white;
                    font-size: 13px;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .phpro-sort-select {
                    flex: 1;
                    background-color: #222;
                    color: white;
                    border: 1px solid #666;
                    border-radius: 6px;
                    padding: 4px 8px;
                    font-size: 13px;
                    cursor: pointer;
                    outline: none;
                    min-width: 0;
                }
                .phpro-sort-select:focus {
                    border-color: orange;
                }
                .phpro-sort-select option {
                    background-color: #222;
                    color: white;
                }
                .phpro-toggle-track:focus-visible {
                    outline: 2px solid orange;
                    outline-offset: 2px;
                }
                /* Marker class for the autoscroll-running visual state. Used by
                   _attachHoverEffects so it can distinguish the active state
                   without depending on the fragile inline backgroundColor value. */
                .phpro-autoscroll-running {
                    background-color: red !important;
                    border-color: red !important;
                }
            `);
		}

		_createMenuContainer() {
			return Utils.createElement('div', {
				id: 'sideMenu',
				role: 'dialog',
				'aria-label': 'Pornhub Pro-ish settings',
				style: {
					position: 'fixed',
					top: '5px',
					padding: '15px',
					maxHeight: '90vh',
					width: 'min-content',
					minWidth: '240px',
					backgroundColor: 'rgba(0,0,0,0.95)',
					zIndex: '999999999',
					display: 'none',
					borderRadius: '10px',
					border: '1px solid orange',
					boxSizing: 'border-box',
					overflowY: 'auto',
					fontFamily: 'Arial, sans-serif',
					fontSize: '13px',
					boxShadow: '0 8px 25px rgba(0,0,0,0.8)',
					transition: `transform ${CONFIG.TIMING.SLIDE_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`,
				},
			});
		}

		// Applies blur filter to the background behind the menu when "Enable transparency" is on.
		// backdrop-filter only affects what's BEHIND the element, not the element's content,
		// so text and buttons remain sharp while the background is blurred.
		_applyOpacityToMenuAndButton() {
			const isTransparent = this._state.get('opaqueMenuButtonState');

			if (this._toggleButton) {
				if (isTransparent) {
					this._toggleButton.style.backdropFilter = 'blur(1.5rem)';
					this._toggleButton.style.WebkitBackdropFilter = 'blur(1.5rem)';
					this._toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
					this._toggleButton.style.opacity = '1';
				} else {
					this._toggleButton.style.backdropFilter = 'none';
					this._toggleButton.style.WebkitBackdropFilter = 'none';
					this._toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
					this._toggleButton.style.opacity = '1';
				}
			}

			if (this._menu) {
				// Toggle the class that drives the section-header tint overrides in CSS.
				this._menu.classList.toggle('phpro-transparent', isTransparent);

				if (isTransparent) {
					// Apply backdrop blur to background behind the menu
					this._menu.style.backdropFilter = 'blur(1.5rem)';
					this._menu.style.WebkitBackdropFilter = 'blur(1.5rem)';
					this._menu.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
				} else {
					// Remove blur and use solid background
					this._menu.style.backdropFilter = 'none';
					this._menu.style.WebkitBackdropFilter = 'none';
					this._menu.style.backgroundColor = 'rgba(0, 0, 0, 1.0)';
				}
			}

			// Re-tint the action buttons so they match the transparency state.
			this._refreshButtonTints();

			Utils.log(`Menu: ${isTransparent ? 'transparent (background blurred)' : 'opaque'}`);
		}

		// WHAT: Returns the resting background colour for action buttons based on the
		//       current transparency toggle.
		// WHERE: Used wherever a button's background is set or reset to its resting
		//        state (initial style, click-flash reset, autoscroll-stop reset).
		// WHY: Centralises the colour choice so transparency tinting stays consistent
		//      and there's a single place to change it.
		_restingButtonBg() {
			return this._state.get('opaqueMenuButtonState') ?
				CONFIG.BUTTON_BG.TRANSPARENT :
				CONFIG.BUTTON_BG.SOLID;
		}

		// WHAT: Updates every tintable action button to the current resting background.
		// WHERE: Called when transparency is toggled so already-rendered buttons update.
		// WHY: Buttons are built once; this re-applies the tint live without a rebuild.
		//      The running autoscroll button is skipped — its red "running" colour is
		//      driven by the .phpro-autoscroll-running CSS class and shouldn't be tinted.
		_refreshButtonTints() {
			if (!this._menu) return;
			const bg = this._restingButtonBg();
			for (const button of this._menu.querySelectorAll('.phpro-tintable-btn')) {
				if (button.classList.contains('phpro-autoscroll-running')) continue;
				button.style.backgroundColor = bg;
			}
		}

		// Restores the button to its saved position. Stored as edge distances so
		// it scales correctly across different viewport sizes.
		// `animate` adds a smooth CSS transition (used after window resize).
		_applySavedPosition(button, animate = false) {
			const MIN_DISTANCE = 12;

			try {
				const saved = CrossDomainStorage.getItem('phpro_menuButtonPos');
				const preferRight = this._state.get('menuButtonRightSideState', false);

				let left, top;

				if (saved) {
					const data = JSON.parse(saved);
					const vw = window.innerWidth;
					const vh = window.innerHeight;

					if (data.horizontal === 'left') {
						left = Math.max(MIN_DISTANCE, data.hDistance);
					} else {
						left = vw - button.offsetWidth - Math.max(MIN_DISTANCE, data.hDistance);
					}

					if (data.vertical === 'top') {
						top = Math.max(MIN_DISTANCE, data.vDistance);
					} else {
						top = vh - button.offsetHeight - Math.max(MIN_DISTANCE, data.vDistance);
					}

					if (preferRight && (!saved || Date.now() - (data.timestamp || 0) < 2000)) {
						left = vw - button.offsetWidth - MIN_DISTANCE;
					}
				} else {
					left = preferRight ?
						window.innerWidth - button.offsetWidth - MIN_DISTANCE :
						MIN_DISTANCE;
					top = MIN_DISTANCE;
				}

				left = Math.max(MIN_DISTANCE, Math.min(left, window.innerWidth - button.offsetWidth - MIN_DISTANCE));
				top = Math.max(MIN_DISTANCE, Math.min(top, window.innerHeight - button.offsetHeight - MIN_DISTANCE));

				if (animate) {
					button.style.transition = 'left 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.25s';
				} else {
					button.style.transition = 'opacity 0.25s, background-color 0.25s';
				}

				button.style.left = `${left}px`;
				button.style.top = `${top}px`;
				button.style.transform = 'translate(0px, 0px)';

			} catch (err) {
				handleError('MenuManager._applySavedPosition', err, 'warn');
				button.style.left = '12px';
				button.style.top = '12px';
			}
		}

		// Saves the button position as relative edge distances so it can be
		// restored correctly at any viewport size.
		_saveButtonPosition(button) {
			try {
				const rect = button.getBoundingClientRect();
				const vw = window.innerWidth;
				const vh = window.innerHeight;

				const distLeft = rect.left;
				const distRight = vw - rect.right;
				const distTop = rect.top;
				const distBottom = vh - rect.bottom;

				const positionData = {
					horizontal: distLeft < distRight ? 'left' : 'right',
					vertical: distTop < distBottom ? 'top' : 'bottom',
					hDistance: Math.min(distLeft, distRight),
					vDistance: Math.min(distTop, distBottom),
					timestamp: Date.now()
				};

				CrossDomainStorage.setItem('phpro_menuButtonPos', JSON.stringify(positionData));
				Utils.log(`Menu button position saved: ${positionData.vertical}-${positionData.horizontal}`);
			} catch (err) {
				handleError('MenuManager._saveButtonPosition', err, 'warn');
			}
		}

		// Returns the array of Feature objects defining every toggle in the menu.
		// Each feature specifies its label, storage key, change handler, and category.
		_buildFeatureDefinitions() {
			return [
				new Feature({
					label: 'Auto-confirm age',
					key: 'autoConfirmAgeState',
					handler: () => {
						if (this._state.get('autoConfirmAgeState')) {
							// Enabled mid-session: set the cookie now so the gate is
							// skipped from the next navigation onward.
							AgeGate.set();
						} else {
							AgeGate.clear();
						}
					},
					id: 'autoConfirmAgeToggle',
					defaultState: true,
					category: 'general',
				}),
				new Feature({
					label: 'Always use English',
					key: 'redirectToEnglishState',
					handler: () => this._eventEmitter.emit('redirectToEnglish'),
					id: 'redirectToEnglishToggle',
					defaultState: true,
					category: 'general',
				}),
				new Feature({
					label: 'Enable transparency',
					key: 'opaqueMenuButtonState',
					handler: () => {
						this._applyOpacityToMenuAndButton();
					},
					id: 'opaqueMenuButtonToggle',
					defaultState: false,
					category: 'general',
				}),
				new Feature({
					label: 'Menu on the right',
					key: 'menuOnRightState',
					handler: () => this._applyMenuSide(),
					id: 'menuOnRightToggle',
					defaultState: false,
					category: 'general',
				}),
				new Feature({
					label: 'Swipe to open',
					key: 'swipeToOpenState',
					handler: () => Utils.log(`Swipe to open: ${this._state.get('swipeToOpenState')}`),
					id: 'swipeToOpenToggle',
					defaultState: false,
					category: 'general',
				}),
				new Feature({
					label: 'Sort within playlists',
					key: 'sortWithinPlaylistsState',
					handler: () => Utils.log('Playlist sorting scope updated'),
					id: 'sortWithinPlaylistsToggle',
					defaultState: false,
					category: 'sorting',
				}),
				// Sort-by mode is rendered as a dropdown, not individual toggles.
				// See _addFeatureToggles → _createSortDropdown().
				new Feature({
					label: 'Mute by default',
					key: 'muteState',
					handler: () => {
						if (this._state.get('muteState')) {
							VideoPlayer.resetMuteState();
							VideoPlayer.mute(true);
						}
					},
					id: 'muteToggle',
					defaultState: false,
					category: 'player',
				}),
				new Feature({
					label: 'Hide cursor on video',
					key: 'cursorHideState',
					// Apply the CSS immediately when toggled, instead of waiting
					// for the next page load.
					handler: () => VideoPlayer.toggleCursorHide(this._state.get('cursorHideState')),
					id: 'cursorHideToggle',
					defaultState: true,
					category: 'player',
				}),
				new Feature({
					label: 'Enable download button',
					key: 'downloadButtonState',
					id: 'downloadButtonToggle',
					defaultState: false,
					category: 'player',
				}),
				new Feature({
					label: 'Hide watched videos',
					key: 'hideWatchedState',
					handler: () => this._eventEmitter.emit('hideVideos'),
					id: 'hideWatchedToggle',
					defaultState: false,
					category: 'filtering',
				}),
				new Feature({
					label: 'Hide paid content',
					key: 'hidePaidContentState',
					handler: () => this._eventEmitter.emit('hideVideos'),
					id: 'hidePaidContentToggle',
					defaultState: true,
					category: 'filtering',
				}),
				new Feature({
					label: 'Hide VR videos',
					key: 'hideVRState',
					handler: () => this._eventEmitter.emit('hideVideos'),
					id: 'hideVRToggle',
					defaultState: false,
					category: 'filtering',
				}),
				new Feature({
					label: 'Hide Shorts section',
					key: 'hideShortsState',
					handler: () => this._eventEmitter.emit('hideVideos'),
					id: 'hideShortsToggle',
					defaultState: false,
					category: 'filtering',
				}),
			];
		}

		// Builds the "Sort by" dropdown row for the sorting category.
		// Stores the selected value as a string under 'sortModeState' in
		// CrossDomainStorage. Valid values are guarded by Utils.getValidSortMode()
		// so a corrupt cookie can't trigger unexpected behaviour.
		// Selecting a mode immediately applies the sort; selecting 'none' does nothing.
		_createSortDropdown() {
			const row = Utils.createElement('div', {
				className: 'phpro-sort-row'
			});

			const label = Utils.createElement('label', {
				textContent: 'Auto-sort:',
				for: 'phpro-sort-select',
			});

			const select = Utils.createElement('select', {
				id: 'phpro-sort-select',
				className: 'phpro-sort-select',
			});

			const options = [{
					value: 'none',
					label: 'Off'
				},
				{
					value: 'duration',
					label: 'By duration'
				},
				{
					value: 'award',
					label: 'By award'
				},
				{
					value: 'views',
					label: 'By views'
				},
			];

			const savedMode = Utils.getValidSortMode();

			for (const opt of options) {
				const el = Utils.createElement('option', {
					value: opt.value,
					textContent: opt.label
				});
				if (opt.value === savedMode) el.selected = true;
				select.appendChild(el);
			}

			select.addEventListener('change', () => {
				// Guard against a tampered dropdown value (e.g. via devtools).
				const mode = CONFIG.SORT.VALID_MODES.includes(select.value) ? select.value : 'none';
				CrossDomainStorage.setItem('sortModeState', mode);
				Utils.log(`Sort mode set to: ${mode}`);
				if (mode === 'duration') this._eventEmitter.emit('sortByDuration');
				else if (mode === 'award') this._eventEmitter.emit('sortByAward');
				else if (mode === 'views') this._eventEmitter.emit('sortByViews');
			});

			row.appendChild(label);
			row.appendChild(select);
			return row;
		}

		// Creates a collapsible section: an orange header that toggles the content
		// div on click. Collapse state is persisted in CrossDomainStorage so it
		// survives page reloads and is synced when a tab regains focus.
		// Returns the content div so the caller can populate it.
		_createSection(title) {
			const storageKey = `phpro_section_${title.replace(/\s+/g, '_').toLowerCase()}_collapsed`;
			const isCollapsed = CrossDomainStorage.getItem(storageKey) === 'true';

			const header = Utils.createElement('h3', {
				className: 'phpro-category-header phpro-section-header',
				role: 'button',
				tabindex: '0',
				'aria-expanded': String(!isCollapsed),
			});

			const titleSpan = Utils.createElement('span', {
				textContent: title
			});
			const arrow = Utils.createElement('span', {
				textContent: isCollapsed ? '▸' : '▾',
				className: 'phpro-section-arrow',
				'aria-hidden': 'true',
			});

			header.appendChild(titleSpan);
			header.appendChild(arrow);

			const content = Utils.createElement('div', {
				className: 'phpro-section-content',
				style: {
					display: isCollapsed ? 'none' : 'block',
					width: '100%'
				},
			});

			const toggleSection = () => {
				const nowCollapsed = content.style.display !== 'none';
				content.style.display = nowCollapsed ? 'none' : 'block';
				arrow.textContent = nowCollapsed ? '▸' : '▾';
				header.setAttribute('aria-expanded', String(!nowCollapsed));
				CrossDomainStorage.setItem(storageKey, String(nowCollapsed));
			};

			header.addEventListener('click', toggleSection);
			header.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleSection();
				}
			});

			this._menu.appendChild(header);
			this._menu.appendChild(content);

			// Register so updateToggleStates() can sync this section across tabs.
			this._sections.push({
				storageKey,
				content,
				arrow,
				header,
			});

			return content;
		}

		// Adds a full-width "Close menu" button at the very bottom of the panel.
		// Uses an inverted colour scheme compared to the other action buttons —
		// orange background with black text by default, swapping to a black
		// background with orange text on hover. This makes the close action
		// visually distinct from the regular toggles and manual-sort buttons
		// without breaking the menu's overall colour language.
		// Replaces the old top-right × button, which was small and oddly placed.
		_addCloseFooterButton() {
			const button = Utils.createElement('button', {
				type: 'button',
				'aria-label': 'Close settings menu',
				textContent: 'Close menu',
				style: {
					marginTop: '10px',
					marginBottom: '0',
					padding: '10px 12px',
					backgroundColor: 'orange',
					color: 'black',
					border: '1px solid orange',
					borderRadius: '10px',
					cursor: 'pointer',
					transition: 'all 0.25s',
					width: '100%',
					fontSize: '13px',
					fontWeight: 'bold',
					fontFamily: 'inherit',
				},
			});

			// Custom hover handlers — _attachHoverEffects assumes the standard
			// black-bg/orange-on-hover pattern, which is the opposite of what
			// this button needs.
			button.addEventListener('mouseenter', () => {
				button.style.backgroundColor = 'black';
				button.style.color = 'orange';
			});
			button.addEventListener('mouseleave', () => {
				button.style.backgroundColor = 'orange';
				button.style.color = 'black';
			});

			button.addEventListener('click', (e) => {
				e.stopPropagation();
				this._hide();
			});

			this._menu.appendChild(button);
		}

		// ── Per-category section builders ───────────────────────────────────────
		// Each method creates a collapsible section for its feature category.
		// To reorder or rename sections, edit create() and the title string here.

		// WHAT: Generic section builder. Creates a collapsible section, fills it with
		//       the toggle rows for the given feature category, then runs optional
		//       extra builders to append non-toggle content (dropdowns, buttons, etc).
		// WHERE: Called by create() once per section.
		// WHY: Every section followed the same create-then-fill pattern; this collapses
		//      six near-identical methods into one. `extras` receives the content div
		//      so callers can append anything that isn't a plain feature toggle.
		_addSection(title, category, ...extras) {
			const content = this._createSection(title);
			for (const builder of extras) {
				if (builder.position === 'before') builder.fn(content);
			}
			if (category) {
				for (const feature of this._features.filter(f => f.category === category)) {
					content.appendChild(this._createToggleRow(feature));
				}
			}
			for (const builder of extras) {
				if (builder.position !== 'before') builder.fn(content);
			}
			return content;
		}

		// WHAT: Appends the three manual one-shot sort buttons to a section.
		// WHERE: Used as an "extra" builder for the merged Sorting section.
		// WHY: Manual sort lives in the same section as auto-sort now, so the user
		//      finds every sorting control in one place. Each button also scrolls the
		//      page to the top after re-ordering.
		_appendManualSortButtons(content) {
			const manualButtons = [{
					text: 'Sort by duration manually',
					handler: () => { this._eventEmitter.emit('sortByDuration', true); this._scrollToTop.scrollToTop(); }
				},
				{
					text: 'Sort by views manually',
					handler: () => { this._eventEmitter.emit('sortByViews', true); this._scrollToTop.scrollToTop(); }
				},
				{
					text: 'Put award first manually',
					handler: () => { this._eventEmitter.emit('sortByAward', true); this._scrollToTop.scrollToTop(); }
				},
			];
			for (const { text, handler } of manualButtons) {
				content.appendChild(this._createActionButton(text, handler));
			}
		}

		// WHAT: Appends the autoscroll + scroll-to-top buttons to a section.
		_appendScrollButtons(content) {
			content.appendChild(this._createAutoscrollButton());
			content.appendChild(this._createScrollToTopButton());
		}

		// Builds the filter-words section content (hide + show-only word filters).
		// Two sub-blocks rendered by _populateFilterWords():
		//   1. "Hide videos matching" — hides items whose title matches (savedFilterWords)
		//   2. "Show only matching"   — inverse filter, hides all but matches (savedShowWords)
		// WHAT: Configuration table describing each keyword-filter type.
		// WHERE: Read by all the generic _*FilterWords helpers below.
		// WHY: The "hide" and "show-only" filters are behaviourally identical apart
		//      from their storage key, chip colour, and a couple of labels. Keeping
		//      those differences in one data table lets a single set of methods serve
		//      both, instead of maintaining two near-duplicate copies of every method.
		//      To add a third filter type, add one entry here.
		static get _FILTER_TYPES() {
			return {
				hide: {
					storageKey: 'savedFilterWords',
					inputId: 'inputFilterWords',
					label: 'Hide videos matching:',
					chipBg: '#ff9800', // orange
					chipColor: 'black',
					ariaVerb: 'filter',
				},
				show: {
					storageKey: 'savedShowWords',
					inputId: 'inputShowWords',
					label: 'Show only matching:',
					chipBg: '#1565c0', // blue, to distinguish from the orange hide chips
					chipColor: 'white',
					ariaVerb: 'show-only',
				},
			};
		}

		// WHAT: Appends the keyword-filter UI (both "hide" and "show-only" blocks)
		//       to an existing section content div.
		// WHERE: Called as an "extra" builder for the merged Filtering section so the
		//        word inputs live in the same collapsible section as the filter toggles.
		// WHY: Takes a content div rather than creating its own section, so the word
		//      filters can be grouped with the related toggle switches.
		_populateFilterWords(content) {
			for (const type of Object.keys(MenuManager._FILTER_TYPES)) {
				content.appendChild(this._buildFilterBlock(type));
			}
		}

		// WHAT: Builds one labelled input + chip-container block for a filter type.
		// WHERE: Called once per filter type by _populateFilterWords().
		// WHY: The two blocks differ only by config; this builds either from the table.
		_buildFilterBlock(type) {
			const cfg = MenuManager._FILTER_TYPES[type];

			const container = Utils.createElement('div', {
				style: {
					marginTop: '10px',
					width: '100%',
					display: 'flex',
					flexDirection: 'column'
				},
			});

			const label = Utils.createElement('label', {
				textContent: cfg.label,
				for: cfg.inputId,
				style: {
					color: 'white',
					display: 'block',
					marginBottom: '6px',
					fontSize: '14px'
				},
			});

			const input = Utils.createElement('input', {
				type: 'text',
				id: cfg.inputId,
				placeholder: 'Type word(s) and press Enter or , to add',
				style: {
					display: 'block',
					padding: '8px 12px',
					border: '1px solid #666',
					borderRadius: '5px',
					fontSize: '14px',
					backgroundColor: '#222',
					color: 'white',
					width: '100%',
					boxSizing: 'border-box',
				},
			});

			const tagsContainer = Utils.createElement('div', {
				style: {
					display: 'flex',
					flexWrap: 'wrap',
					gap: '6px',
					marginTop: '8px',
					minHeight: '0px'
				},
			});

			// Keep references so updateToggleStates() can re-render chips on tab focus
			// and so the add/remove handlers can clear the input.
			this._filterRefs[type] = {
				input,
				tagsContainer
			};

			container.appendChild(label);
			container.appendChild(input);
			container.appendChild(tagsContainer);

			this._renderFilterTags(type);

			const commit = () => {
				const value = input.value.trim();
				if (value) this._addFilterWord(type, value);
			};
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ',') {
					e.preventDefault();
					commit();
				}
			});
			input.addEventListener('blur', commit);

			return container;
		}

		// WHAT: Reads saved words for a filter type from storage as a cleaned array.
		// WHERE: Used by every add/remove/render operation.
		// WHY: Single accessor keeps the storage key and sanitisation in one place.
		_getFilterWords(type) {
			const cfg = MenuManager._FILTER_TYPES[type];
			const saved = CrossDomainStorage.getItem(cfg.storageKey) ?? '';
			return Utils.sanitizeFilterWords(saved);
		}

		// WHAT: Writes the word list for a filter type back to storage.
		_saveFilterWords(type, wordsArray) {
			const cfg = MenuManager._FILTER_TYPES[type];
			CrossDomainStorage.setItem(cfg.storageKey, wordsArray.join(', '));
		}

		// WHAT: Adds a word to a filter type (if new), persists it, re-renders chips,
		//       clears the input, and triggers a hide pass.
		_addFilterWord(type, word) {
			word = word.trim().toLowerCase();
			if (!word) return;

			const words = this._getFilterWords(type);
			const input = this._filterRefs[type]?.input;
			if (words.includes(word)) {
				if (input) input.value = '';
				return;
			}

			words.push(word);
			this._saveFilterWords(type, words);
			this._renderFilterTags(type);
			if (input) input.value = '';
			this._eventEmitter.emit('hideVideos');
		}

		// WHAT: Removes a word from a filter type, persists, re-renders, re-filters.
		_removeFilterWord(type, word) {
			const words = this._getFilterWords(type).filter(w => w !== word);
			this._saveFilterWords(type, words);
			this._renderFilterTags(type);
			this._eventEmitter.emit('hideVideos');
		}

		// WHAT: Clears and rebuilds all chips for a filter type from saved storage.
		// WHERE: Called after add/remove and on tab focus (via updateToggleStates).
		// WHY: Rendering from the single source of truth (storage) avoids the UI and
		//      the saved list drifting out of sync.
		_renderFilterTags(type) {
			const refs = this._filterRefs[type];
			if (!refs?.tagsContainer) return;
			refs.tagsContainer.innerHTML = '';
			for (const word of this._getFilterWords(type)) {
				refs.tagsContainer.appendChild(this._createFilterChip(type, word));
			}
		}

		// WHAT: Builds one removable pill chip for a word in a given filter type.
		// WHY: Colour and aria text come from the config table so one builder serves
		//      both the orange hide chips and the blue show-only chips.
		_createFilterChip(type, word) {
			const cfg = MenuManager._FILTER_TYPES[type];

			const tag = Utils.createElement('div', {
				style: {
					display: 'inline-flex',
					alignItems: 'center',
					backgroundColor: cfg.chipBg,
					color: cfg.chipColor,
					padding: '4px 10px',
					borderRadius: '20px',
					fontSize: '13px',
					fontWeight: 'bold',
					whiteSpace: 'nowrap',
					boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
				},
			});

			const text = Utils.createElement('span', {
				textContent: word,
				style: {
					marginRight: '6px'
				},
			});

			const removeBtn = Utils.createElement('span', {
				textContent: '×',
				role: 'button',
				tabindex: '0',
				'aria-label': `Remove ${cfg.ariaVerb} word ${word}`,
				style: {
					cursor: 'pointer',
					fontSize: '16px',
					fontWeight: 'bold',
					lineHeight: '1',
					padding: '0 2px',
				},
			});

			const doRemove = (e) => {
				e.stopPropagation();
				this._removeFilterWord(type, word);
			};
			removeBtn.addEventListener('click', doRemove);
			removeBtn.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					doRemove(e);
				}
			});

			tag.appendChild(text);
			tag.appendChild(removeBtn);
			return tag;
		}

		// Builds a single toggle row: pill-shaped track with sliding thumb + label.
		// Both the track and label are clickable. Track has role="switch" and is
		// keyboard-operable via Enter/Space.
		_createToggleRow(feature) {
			const container = Utils.createElement('div', {
				style: {
					display: 'flex',
					alignItems: 'center',
					marginBottom: '10px',
					width: '100%'
				},
			});

			const isActive = this._state.get(feature.key, feature.defaultState);

			const track = Utils.createElement('div', {
				id: feature.id,
				className: 'phpro-toggle-track',
				role: 'switch',
				tabindex: '0',
				'aria-checked': String(isActive),
				'aria-label': feature.label,
				style: {
					position: 'relative',
					width: '40px',
					height: '20px',
					backgroundColor: isActive ? 'orange' : '#666',
					borderRadius: '20px',
					cursor: 'pointer',
					transition: 'background-color 0.2s',
					flexShrink: '0',
					border: '1px solid white',
				},
			});

			const thumb = Utils.createElement('div', {
				style: {
					position: 'absolute',
					left: isActive ? '22px' : '2px',
					top: '50%',
					transform: 'translateY(-50%)',
					width: '16px',
					height: '16px',
					backgroundColor: 'white',
					borderRadius: '50%',
					transition: 'left 0.2s',
					boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
				},
			});
			track.appendChild(thumb);

			const labelEl = Utils.createElement('span', {
				textContent: feature.label,
				style: {
					color: 'white',
					marginLeft: '12px',
					fontSize: '13px',
					lineHeight: '20px',
					cursor: 'pointer',
					width: 'max-content',
				},
			});

			const onActivate = () => this._handleToggleClick(feature, track, thumb);
			track.addEventListener('click', onActivate);
			labelEl.addEventListener('click', onActivate);
			track.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onActivate();
				}
			});

			container.appendChild(track);
			container.appendChild(labelEl);
			return container;
		}

		// Creates the draggable floating "☰ Menu" button.
		// See the MenuManager class comment for the full drag/tap event flow.
		_createToggleButton() {
			const isTransparent = this._state.get('opaqueMenuButtonState', false);

			const button = Utils.createElement('div', {
				id: 'menuToggle',
				role: 'button',
				tabindex: '0',
				'aria-label': 'Open Pornhub Pro-ish settings',
				textContent: '☰ Menu',
				style: {
					position: 'fixed',
					left: '12px',
					top: '12px',
					fontSize: '13px',
					color: 'orange',
					cursor: 'grab',
					zIndex: '999999998',
					padding: '8px 15px',
					backgroundColor: 'rgba(0, 0, 0, 0.9)',
					border: '2px solid orange',
					borderRadius: '9999px',
					fontWeight: 'bold',
					fontFamily: 'Arial, sans-serif',
					userSelect: 'none',
					boxShadow: '0 4px 15px rgba(0,0,0,0.7)',
					transition: 'background-color 0.25s, opacity 0.6s',
					willChange: 'transform',
					whiteSpace: 'nowrap',
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					minWidth: 'auto',
					boxSizing: 'border-box',
				},
			});

			const applyInitialPosition = () => {
				this._applySavedPosition(button, false);
			};

			applyInitialPosition();
			requestAnimationFrame(applyInitialPosition);
			window.addEventListener('load', applyInitialPosition, {
				once: true
			});

			button.addEventListener('click', e => {
				if (this._wasDragged) return;
				e.stopPropagation();
				this._togglePanel();
			});

			// Keyboard activation (Enter/Space)
			button.addEventListener('keydown', e => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this._togglePanel();
				}
			});

			button.addEventListener('mouseenter', () => {
				this._cancelButtonFade();
				button.style.backgroundColor = this._state.get('opaqueMenuButtonState')
					? 'rgba(122, 59, 0, 0.5)'
					: '#7a3b00';
			});

			button.addEventListener('mouseleave', () => {
				button.style.backgroundColor = this._state.get('opaqueMenuButtonState')
					? 'rgba(0, 0, 0, 0.3)'
					: 'rgba(0, 0, 0, 0.9)';
				this._scheduleButtonFade();
			});

			let isDragging = false;
			let rafId = null;
			let startX = 0,
				startY = 0;
			let baseLeft = 0,
				baseTop = 0;
			let currentTx = 0,
				currentTy = 0;
			this._wasDragged = false;

			const SNAP_MARGIN = 90;

			const snapToEdge = (rawLeft, rawTop) => {
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				const rect = button.getBoundingClientRect();
				const w = rect.width;
				const h = rect.height;

				let finalLeft = rawLeft;
				let finalTop = rawTop;

				if (rawLeft < SNAP_MARGIN) finalLeft = 12;
				else if (rawLeft > vw - w - SNAP_MARGIN) finalLeft = vw - w - 12;

				if (rawTop < SNAP_MARGIN) finalTop = 12;
				else if (rawTop > vh - h - SNAP_MARGIN) finalTop = vh - h - 12;

				return {
					left: finalLeft,
					top: finalTop
				};
			};

			const applyTransform = () => {
				button.style.transform = `translate(${currentTx}px, ${currentTy}px)`;
			};

			// Drag threshold: mouse is precise (5px), touch needs more
			// room to avoid normal finger wobble being mistaken for a drag
			const MOUSE_DRAG_THRESHOLD = 5;
			const TOUCH_DRAG_THRESHOLD = 15;

			const onDragStart = (clientX, clientY) => {
				this._wasDragged = false;
				isDragging = false;
				startX = clientX;
				startY = clientY;

				const rect = button.getBoundingClientRect();
				button.style.width = `${rect.width}px`;
				button.style.height = `${rect.height}px`;

				baseLeft = parseFloat(getComputedStyle(button).left) || 12;
				baseTop = parseFloat(getComputedStyle(button).top) || 12;

				button.style.transition = 'none';
				button.style.transform = 'translate(0px, 0px)';
			};

			const onDragMove = (clientX, clientY, threshold) => {
				const dx = clientX - startX;
				const dy = clientY - startY;

				if (!isDragging && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
					isDragging = true;
					this._wasDragged = true;
					button.style.cursor = 'grabbing';
				}

				if (isDragging) {
					currentTx = dx;
					currentTy = dy;
					if (rafId === null) {
						rafId = requestAnimationFrame(() => {
							applyTransform();
							rafId = null;
						});
					}
				}
			};

			const onDragEnd = () => {
				if (rafId) {
					cancelAnimationFrame(rafId);
					rafId = null;
				}

				if (isDragging) {
					const rawLeft = baseLeft + currentTx;
					const rawTop = baseTop + currentTy;
					const snapped = snapToEdge(rawLeft, rawTop);

					button.style.width = '';
					button.style.height = '';
					button.style.transition = 'opacity 0.25s, background-color 0.25s';
					button.style.left = `${snapped.left}px`;
					button.style.top = `${snapped.top}px`;
					button.style.transform = 'translate(0px, 0px)';

					this._saveButtonPosition(button);
				}

				button.style.cursor = 'grab';
				button.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
				isDragging = false;
			};

			// --- Mouse drag ---
			button.addEventListener('mousedown', e => {
				if (e.button !== 0) return;
				onDragStart(e.clientX, e.clientY);

				const onMouseMove = (moveEvent) => onDragMove(moveEvent.clientX, moveEvent.clientY, MOUSE_DRAG_THRESHOLD);
				const onMouseUp = () => {
					document.removeEventListener('mousemove', onMouseMove);
					document.removeEventListener('mouseup', onMouseUp);
					onDragEnd();
				};

				document.addEventListener('mousemove', onMouseMove, {
					passive: true
				});
				document.addEventListener('mouseup', onMouseUp);
			});

			// --- Touch drag ---
			// Uses a larger threshold so normal tap wobble doesn't register as a drag
			button.addEventListener('touchstart', e => {
				if (e.touches.length !== 1) return;
				const t = e.touches[0];
				onDragStart(t.clientX, t.clientY);
			}, {
				passive: true
			});

			button.addEventListener('touchmove', e => {
				if (e.touches.length !== 1) return;
				const t = e.touches[0];
				onDragMove(t.clientX, t.clientY, TOUCH_DRAG_THRESHOLD);
				if (isDragging) e.preventDefault();
			}, {
				passive: false
			});

			button.addEventListener('touchend', e => {
				const wasDragged = this._wasDragged;
				onDragEnd();
				if (!wasDragged) {
					e.preventDefault(); // suppress the synthetic click that fires ~300ms later
					this._togglePanel();
				}
			}, {
				passive: false
			});

			window.addEventListener('resize', Utils.debounce(() => {
				const btn = document.getElementById('menuToggle');
				if (btn) this._applySavedPosition(btn, true);
			}, 300));

			return button;
		}

		// Creates a generic action button that flashes orange briefly on click.
		// The .phpro-tintable-btn class lets _refreshButtonTints() re-tint it when
		// the transparency toggle changes.
		_createActionButton(text, clickHandler) {
			const button = Utils.createElement('button', {
				type: 'button',
				className: 'phpro-tintable-btn',
				textContent: text,
				style: {
					marginBottom: '10px',
					padding: '8px 12px',
					backgroundColor: this._restingButtonBg(),
					color: 'white',
					border: '1px solid white',
					borderRadius: '10px',
					cursor: 'pointer',
					transition: 'all 0.3s',
					width: '100%',
					fontSize: '13px',
				},
			});

			this._attachHoverEffects(button);

			button.addEventListener('click', () => {
				button.style.backgroundColor = 'orange';
				setTimeout(() => {
					button.style.backgroundColor = this._restingButtonBg();
				}, CONFIG.TIMING.BUTTON_FLASH_MS);
				clickHandler();
			});

			return button;
		}

		// Creates the Start/Stop Autoscroll button. Label and colour are updated
		// by _onAutoscrollStateChanged when the running state changes.
		_createAutoscrollButton() {
			const button = Utils.createElement('button', {
				type: 'button',
				id: 'autoscrollButton',
				className: 'phpro-tintable-btn',
				textContent: 'Start Autoscroll',
				style: {
					marginBottom: '15px',
					padding: '8px 12px',
					backgroundColor: this._restingButtonBg(),
					color: 'white',
					border: '1px solid white',
					borderRadius: '10px',
					cursor: 'pointer',
					transition: 'all 0.3s',
					width: '100%',
				},
			});

			this._attachHoverEffects(button);
			button.addEventListener('click', () => this._autoScroller.toggle());
			return button;
		}

		// WHAT: Creates the "Scroll to top" button.
		// WHY: It's a standard flash-on-click action button, so it delegates to
		//      _createActionButton instead of duplicating the markup and handlers.
		_createScrollToTopButton() {
			const button = this._createActionButton(
				'Scroll to top of the page',
				() => this._scrollToTop.scrollToTop()
			);
			button.id = 'scrolltotopButton';
			// This button uses 15px bottom margin (vs the default 10px) to match the
			// autoscroll button it sits beneath.
			button.style.marginBottom = '15px';
			return button;
		}

		// Called when a toggle is clicked. Updates state, animates the track/thumb,
		// then calls the feature handler via setTimeout so the UI paint happens first.
		_handleToggleClick(feature, track, thumb) {
			try {
				const newState = this._state.toggle(feature.key);
				track.style.backgroundColor = newState ? 'orange' : '#666';
				track.setAttribute('aria-checked', String(newState));
				thumb.style.left = newState ? '22px' : '2px';
				setTimeout(() => feature.handler(), 0);
			} catch (err) {
				handleError(`MenuManager._handleToggleClick("${feature.key}")`, err);
			}
		}

		// Updates the autoscroll button label and visual state to reflect running.
		// Uses a CSS class rather than an inline-style sentinel so the hover
		// handler in _attachHoverEffects can detect the state robustly.
		_onAutoscrollStateChanged({
			isRunning
		}) {
			const button = document.getElementById('autoscrollButton');
			if (!button) return;
			if (isRunning) {
				button.textContent = 'Stop Autoscroll';
				button.classList.add('phpro-autoscroll-running');
			} else {
				button.textContent = 'Start Autoscroll';
				button.classList.remove('phpro-autoscroll-running');
				// Reset inline styles in case _attachHoverEffects left them.
				// Use the tint helper so the resting colour matches the transparency state.
				button.style.backgroundColor = this._restingButtonBg();
				button.style.borderColor = 'white';
				button.style.color = 'white';
			}
		}

		// Toggles the panel open/closed. `force` true/false overrides the current
		// state (used by the dismiss handler to always close).
		_togglePanel(force) {
			const willOpen = force !== undefined ? force : this._menu.style.display === 'none';
			willOpen ? this._show() : this._hide();
		}

		// Fades the menu button to nearly invisible after BUTTON_FADE_DELAY_MS when
		// swipe-to-open is enabled. The button is still interactive when faded —
		// hover/touch restores it and re-arms the timer on leave.
		// Called on page load (from create()), after panel close, and on mouseleave.
		_scheduleButtonFade() {
			if (!this._state.get('swipeToOpenState')) return;
			this._cancelButtonFade();
			this._fadeTimer = setTimeout(() => {
				if (this._panelOpen || !this._toggleButton) return;
				this._toggleButton.style.opacity = '0.15';
			}, CONFIG.TIMING.BUTTON_FADE_DELAY_MS);
		}

		// Cancels any pending fade timer and restores the button to full opacity.
		_cancelButtonFade() {
			if (this._fadeTimer !== null) {
				clearTimeout(this._fadeTimer);
				this._fadeTimer = null;
			}
			if (this._toggleButton) {
				this._toggleButton.style.opacity = '1';
			}
		}

		_show() {
			if (!this._menu) return;
			const onRight = this._state.get('menuOnRightState');
			const offScreen = onRight ? 'translateX(110%)' : 'translateX(-110%)';

			// Place off-screen instantly, make visible, then animate to resting position.
			// Two rAF calls ensure the browser paints the off-screen position first so
			// the transition fires correctly instead of being skipped.
			this._menu.style.transition = 'none';
			this._menu.style.transform = offScreen;
			this._menu.style.display = 'block';
			requestAnimationFrame(() => requestAnimationFrame(() => {
				this._menu.style.transition = `transform ${CONFIG.TIMING.SLIDE_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
				this._menu.style.transform = 'translateX(0)';
			}));

			this._panelOpen = true;
			this._cancelButtonFade();
		}

		_hide() {
			if (!this._menu) return;
			const onRight = this._state.get('menuOnRightState');
			const offScreen = onRight ? 'translateX(110%)' : 'translateX(-110%)';

			this._menu.style.transition = `transform ${CONFIG.TIMING.SLIDE_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
			this._menu.style.transform = offScreen;

			// Hide after the slide-out transition completes. Guard with _panelOpen
			// so a rapid re-open before the timer fires doesn't hide the menu again.
			setTimeout(() => {
				if (!this._panelOpen) this._menu.style.display = 'none';
			}, CONFIG.TIMING.SLIDE_MS + 20);

			this._panelOpen = false;
			this._swipeOpenedFromSide = null;
			this._scheduleButtonFade();
		}

		// WHAT: Positions the menu panel on the left or right based on menuOnRightState.
		// WHERE: Called on create() and when the toggle changes.
		// WHY: left/right must be set via JS (not CSS) because the panel is fixed-position
		//      and the side can change at runtime without a page reload.
		_applyMenuSide() {
			if (!this._menu) return;
			const onRight = this._state.get('menuOnRightState');
			this._menu.style.left = onRight ? 'auto' : '5px';
			this._menu.style.right = onRight ? '5px' : 'auto';
		}

		_toggleVisibility() {
			this._togglePanel();
		}

		// Closes the panel when the user clicks or taps outside it.
		// Listens on both mousedown (desktop) and touchstart (mobile).
		_setupPanelDismiss() {
			const handler = e => {
				if (!this._panelOpen) return;
				const clickedInsideMenu = this._menu.contains(e.target);
				const clickedToggleButton = e.target === this._toggleButton ||
					this._toggleButton.contains(e.target);
				if (!clickedInsideMenu && !clickedToggleButton) {
					this._togglePanel(false);
				}
			};
			document.addEventListener('mousedown', handler);
			document.addEventListener('touchstart', handler, {
				passive: true
			});
			// Escape closes the panel — standard dialog behaviour.
			document.addEventListener('keydown', e => {
				if (e.key === 'Escape' && this._panelOpen) {
					this._togglePanel(false);
				}
			});
		}

		// WHAT: Enables swipe gestures to open and close the menu on touchscreens.
		//
		//   Open:  swipe right from the left edge  → opens the menu
		//          swipe left  from the right edge → opens the menu
		//
		//   Close: swipe left  on the menu (when opened from left)
		//          swipe right on the menu (when opened from right)
		//
		// WHERE: Called once from create(), after the menu element exists.
		// WHY: Swipe-from-edge is the standard mobile gesture for off-canvas panels.
		//      Tracking which edge opened the panel lets the close gesture feel natural
		//      — you always swipe back toward where it came from.
		_setupTouchHandlers() {
			const TOUCH = CONFIG.TIMING.TOUCH;
			let startX = 0;
			let startY = 0;

			// ── Edge swipe to open ─────────────────────────────────────────────────
			document.addEventListener('touchstart', e => {
				startX = e.touches[0].clientX;
				startY = e.touches[0].clientY;
			}, { passive: true });

			document.addEventListener('touchend', e => {
				if (!this._state.get('swipeToOpenState')) return;
				if (this._panelOpen) return;
				if (this._menu.contains(e.target)) return;

				const dx = e.changedTouches[0].clientX - startX;
				const dy = e.changedTouches[0].clientY - startY;

				if (Math.abs(dx) < TOUCH.SWIPE_MIN_PX) return;
				if (Math.abs(dy) > Math.abs(dx)) return;

				const W = window.innerWidth;
				const onRight = this._state.get('menuOnRightState');

				// Only the edge matching the menu's side triggers an open gesture.
				const fromLeft  = !onRight && startX <= TOUCH.EDGE_THRESHOLD_PX && dx > 0;
				const fromRight =  onRight && startX >= W - TOUCH.EDGE_THRESHOLD_PX && dx < 0;

				if (fromLeft) {
					this._swipeOpenedFromSide = 'left';
					this._show();
				} else if (fromRight) {
					this._swipeOpenedFromSide = 'right';
					this._show();
				}
			}, { passive: true });

			// ── Swipe on menu to close ─────────────────────────────────────────────
			this._menu.addEventListener('touchstart', e => {
				startX = e.touches[0].clientX;
				startY = e.touches[0].clientY;
			}, { passive: true });

			this._menu.addEventListener('touchend', e => {
				const dx = e.changedTouches[0].clientX - startX;
				const dy = e.changedTouches[0].clientY - startY;

				if (Math.abs(dx) < TOUCH.SWIPE_MIN_PX) return;
				if (Math.abs(dy) > Math.abs(dx)) return;

				// Swipe back toward the edge the menu came from.
				// If opened via button (null), accept whichever direction matches the side.
				const onRight = this._state.get('menuOnRightState');
				const side = this._swipeOpenedFromSide ?? (onRight ? 'right' : 'left');
				const shouldClose = (side === 'left' && dx < 0) || (side === 'right' && dx > 0);

				if (shouldClose) this._hide();
			}, { passive: true });
		}

		// Re-reads all toggle states directly from CrossDomainStorage (bypassing the
		// StateManager cache entirely) and updates the UI to match.
		// Called when the tab becomes visible so changes made in another tab are
		// always reflected without relying on the cache being fresh.
		updateToggleStates() {
			try {
				for (const feature of this._features) {
					const track = document.getElementById(feature.id);
					if (!track) continue;
					// Read straight from storage — skips the in-memory cache so another
					// tab's writes are picked up immediately on visibility restore.
					const raw = CrossDomainStorage.getItem(feature.key);
					const isActive = raw !== null ? raw === 'true' : feature.defaultState;
					const thumb = track.querySelector('div');
					track.style.backgroundColor = isActive ? 'orange' : '#666';
					track.setAttribute('aria-checked', String(isActive));
					if (thumb) thumb.style.left = isActive ? '22px' : '2px';
				}
				// Sync the sort dropdown
				const select = document.getElementById('phpro-sort-select');
				if (select) {
					select.value = Utils.getValidSortMode();
				}
				// Sync section collapse states — picks up changes made in another tab.
				for (const section of this._sections) {
					const isCollapsed = CrossDomainStorage.getItem(section.storageKey) === 'true';
					section.content.style.display = isCollapsed ? 'none' : 'block';
					section.arrow.textContent = isCollapsed ? '▸' : '▾';
					if (section.header) section.header.setAttribute('aria-expanded', String(!isCollapsed));
				}
				// Sync filter tag chips — re-render every filter type from storage.
				for (const type of Object.keys(MenuManager._FILTER_TYPES)) {
					this._renderFilterTags(type);
				}
			} catch (err) {
				handleError('MenuManager.updateToggleStates', err);
			}
		}

		// Removes the injected stylesheet. Called by App._cleanup().
		cleanup() {
			this._styleSheet?.remove();
		}

		// Adds orange hover colour, guarding against overriding the autoscroll
		// active state. Uses the marker class instead of comparing background
		// strings so a future style change can't silently break the check.
		_attachHoverEffects(button) {
			button.addEventListener('mouseenter', () => {
				if (!button.classList.contains('phpro-autoscroll-running')) {
					button.style.color = 'orange';
					button.style.borderColor = 'orange';
				}
			});
			button.addEventListener('mouseleave', () => {
				if (!button.classList.contains('phpro-autoscroll-running')) {
					button.style.color = 'white';
					button.style.borderColor = 'white';
				}
			});
		}
	}

	// ---------------------------------------------------------------------------
	// App
	//
	// Top-level controller that wires all feature classes together and manages
	// the DOM observer that watches for new video items added by infinite scroll.
	//
	// Initialisation sequence (App.init):
	//   1. Hide unwanted site elements
	//   2. Start language redirect if enabled
	//   3. Apply cursor-hide CSS if enabled
	//   4. Initialise PlaylistManager (attaches delete-overlay listener)
	//   5. Build the menu UI
	//   6. Set the age-gate cookie if enabled
	//   7. Initialise the download button if enabled
	//   8. Run all active features after a short delay
	//   9. Start the MutationObserver
	//  10. Set up window-level listeners (visibility, load, unload, errors)
	//
	// MutationObserver strategy:
	//   Watches video list <ul> containers when available, falls back to
	//   document.body. When new <li> items are added, runs an incremental hide
	//   pass on just those nodes, then debounces a full feature re-run. If new
	//   containers appear it re-scopes to watch them directly. During autoscroll
	//   the observer is paused to avoid fighting with the fetch loop.
	// ---------------------------------------------------------------------------

	class App {
		constructor() {
			this._eventEmitter = new EventEmitter();
			this._state = new StateManager(this._eventEmitter);
			this._autoScroller = new AutoScroller(this._eventEmitter);
			this._videoSorter = new VideoSorter(this._state);
			this._videoHider = new VideoHider(this._state, this._videoSorter);
			this._languageManager = new LanguageManager(this._state);
			this._playlistManager = new PlaylistManager();
			this._scrollToTop = new ScrollToTop();
			this._menu = new MenuManager(
				this._state, this._eventEmitter, this._autoScroller, this._scrollToTop
			);

			this._observer = null;
			this._observedTargets = new Set();
			this._lastLiCount = 0;

			this._debouncedInit = Utils.debounce(
				this._initializeFeatures.bind(this),
				CONFIG.TIMING.MUTATION_DEBOUNCE_MS
			);

			this._setupStateValidators();
			this._setupEventHandlers();
		}

		// WHAT: Registers type validators so corrupt stored values can't crash the script.
		// WHERE: Called once during construction, after the menu (and its feature list)
		//        has been created.
		// WHY: localStorage/cookies can be hand-edited; validators reject bad writes.
		//      The boolean keys are derived from the menu's Feature definitions so this
		//      list can't drift out of sync when a feature is added or removed — the
		//      Feature table is the single source of truth. Keys not backed by a toggle
		//      feature (e.g. the right-side position preference) are added explicitly.
		//      sortModeState is intentionally excluded: it's a string, not a boolean.
		_setupStateValidators() {
			const featureBoolKeys = this._menu._features.map(f => f.key);
			const extraBoolKeys = ['menuButtonRightSideState'];

			for (const key of [...featureBoolKeys, ...extraBoolKeys]) {
				this._state.addValidator(key, v => typeof v === 'boolean');
			}
		}

		// Wires up all EventEmitter listeners — the central event routing table.
		_setupEventHandlers() {
			this._eventEmitter.on('sortByAward', data => this._videoSorter.sortByAward(data === true));
			this._eventEmitter.on('sortByDuration', data => this._videoSorter.sortByDuration(data === true));
			this._eventEmitter.on('sortByViews', data => this._videoSorter.sortByViews(data === true));
			this._eventEmitter.on('hideVideos', () => this._videoHider.hideVideos());
			this._eventEmitter.on('redirectToEnglish', () => this._languageManager.redirectToEnglish());
			this._eventEmitter.on('toggleCursorHide', () => VideoPlayer.toggleCursorHide(this._state.get('cursorHideState')));

			this._eventEmitter.on('stateChanged', ({
				key,
				newValue
			}) => {
				Utils.log(`State changed: ${key} = ${newValue}`);
			});

			this._eventEmitter.on('autoscrollStateChanged', ({
				isRunning
			}) => {
				if (isRunning) {
					this._observer?.disconnect();
					Utils.log('App: autoscroll started, observer paused');
				} else {
					Utils.log('App: autoscroll stopped, running features & resuming observer');
					this._initializeFeatures();
					this._setupObserver();
					// Delay the scroll so it fires after DOM mutations from
					// _initializeFeatures / _setupObserver have fully settled.
					setTimeout(() => this._scrollToTop.scrollToTop(), CONFIG.TIMING.MUTATION_DEBOUNCE_MS + 50);
				}
			});
		}

		// Main initialisation — called once the DOM is ready.
		async init() {
			try {
				Utils.log('App: initializing');

				ElementHider.hideElements();
				this._languageManager.redirectToEnglish();
				VideoPlayer.toggleCursorHide(this._state.get('cursorHideState', true));

				this._playlistManager.init();
				this._menu.create();

				// If the page was served without the age-gate cookie (gate shown),
				// the cookie is now set — reload once here where reload is reliable.
				// reloadIfNeeded() does its own enabled check (default = on).
				AgeGate.reloadIfNeeded();

				// Kick off download button if already enabled (e.g. on video pages).
				// Passes the eventEmitter explicitly instead of leaking it via stateManager.
				DownloadManager.init(this._state, this._eventEmitter);

				setTimeout(() => this._initializeFeatures(), CONFIG.TIMING.FEATURE_INIT_DELAY_MS);

				this._setupObserver();
				this._setupWindowListeners();

				Utils.log('App: initialized successfully');
			} catch (err) {
				handleError('App.init', err);
			}
		}

		// Applies all currently-enabled features to the page.
		// Called on init and after DOM mutations settle (via _debouncedInit).
		// Sorting is driven entirely by the unified sortModeState dropdown now;
		// the legacy sortBy*State booleans are no longer consulted.
		_initializeFeatures() {
			try {
				const sortMode = Utils.getValidSortMode();
				if (sortMode === 'duration') this._videoSorter.sortByDuration();
				else if (sortMode === 'award') this._videoSorter.sortByAward();
				else if (sortMode === 'views') this._videoSorter.sortByViews();

				if (
					this._state.get('hideWatchedState') ||
					this._state.get('hidePaidContentState') ||
					this._state.get('hideVRState') ||
					this._state.get('hideShortsState')
				) {
					this._videoHider.hideVideos();
				}
				if (this._state.get('muteState')) VideoPlayer.mute();
				Utils.log('App: features initialized');
			} catch (err) {
				handleError('App._initializeFeatures', err);
			}
		}

		// Returns all ul.videos elements currently in the DOM.
		_getScopeTargets() {
			return Utils.safeQuerySelectorAll('ul.videos');
		}

		// Counts total <li> items across a set of root elements.
		// Used to detect when the site has added or removed video items.
		_countLisIn(roots) {
			return roots.reduce((sum, root) => sum + root.querySelectorAll('li').length, 0);
		}

		// Sets up (or re-scopes) the MutationObserver. Prefers specific video
		// list containers for efficiency; falls back to document.body if none exist.
		_setupObserver() {
			try {
				this._observer?.disconnect();
				this._observedTargets.clear();

				const scopeTargets = this._getScopeTargets();
				const observeBody = scopeTargets.length === 0;

				const roots = observeBody ? [document.body] : scopeTargets;
				for (const el of roots) this._observedTargets.add(el);

				this._lastLiCount = this._countLisIn(roots);

				const observeOptions = {
					childList: true,
					subtree: true,
					attributes: false,
					characterData: false,
				};

				this._observer = new MutationObserver(
					Utils.throttle(
						mutations => this._onMutations(mutations, observeBody),
						CONFIG.TIMING.OBSERVER_THROTTLE_MS
					)
				);

				for (const root of roots) {
					this._observer.observe(root, observeOptions);
				}

				Utils.log(
					observeBody ?
					'App: observer watching document.body (fallback — no containers found yet)' :
					`App: observer scoped to ${roots.length} container(s)`
				);
			} catch (err) {
				handleError('App._setupObserver', err);
			}
		}

		// MutationObserver callback.
		// Case 1: new video list containers appeared → re-scope the observer.
		// Case 2: <li> count changed → incremental hide pass + debounced full re-run.
		_onMutations(mutations, watchingBody) {
			try {
				const addedNodes = mutations.flatMap(m =>
					Array.from(m.addedNodes).filter(n => n.nodeType === Node.ELEMENT_NODE)
				);

				const newTargets = this._getScopeTargets().filter(
					el => !this._observedTargets.has(el)
				);

				if (newTargets.length > 0) {
					Utils.log(`App: ${newTargets.length} new scopeable container(s) found — re-scoping observer`);
					this._setupObserver();
					this._debouncedInit();
					return;
				}

				const observedRoots = Array.from(this._observedTargets);
				const currentLiCount = this._countLisIn(observedRoots);

				if (currentLiCount !== this._lastLiCount) {
					Utils.log(`App: li count changed ${this._lastLiCount} → ${currentLiCount}`);
					this._lastLiCount = currentLiCount;

					if (
						addedNodes.length > 0 &&
						(
							this._state.get('hideWatchedState') ||
							this._state.get('hidePaidContentState') ||
							this._state.get('hideVRState')
						)
					) {
						this._videoHider.hideVideos(addedNodes);
					}

					this._debouncedInit();
				}
			} catch (err) {
				handleError('App._onMutations', err);
			}
		}

		// Registers window-level listeners needed for the lifetime of the page.
		_setupWindowListeners() {
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') {
					Utils.log('App: tab visible — syncing state');
					try {
						this._state.clearCache();
						this._menu.updateToggleStates();

						const menuButton = document.getElementById('menuToggle');
						if (menuButton) {
							this._menu._applySavedPosition(menuButton, true);
						}

						setTimeout(() => this._initializeFeatures(), CONFIG.TIMING.FEATURE_INIT_DELAY_MS);
					} catch (err) {
						handleError('App.visibilitychange', err);
					}
				} else {
					VideoPlayer.resetMuteState();
				}
			});

			window.addEventListener('load', () => {
				setTimeout(() => ElementHider.hideElements(), CONFIG.TIMING.ELEMENT_HIDE_LOAD_DELAY_MS);
			});

			window.addEventListener('beforeunload', () => {
				this._cleanup();
			});

			window.addEventListener('error', event => {
				if (event.filename?.includes('Pornhub Pro-ish')) {
					handleError('window.onerror', new Error(event.message));
				}
			});
		}

		// Tears down observers, stops autoscroll, removes menu, clears listeners.
		// Called on beforeunload to avoid memory leaks.
		_cleanup() {
			try {
				this._observer?.disconnect();
				this._observer = null;
				this._observedTargets.clear();
				if (this._autoScroller.isRunning) this._autoScroller.stop();
				this._menu.cleanup();
				this._eventEmitter.removeAllListeners();
				Utils.log('App: cleanup complete');
			} catch (err) {
				handleError('App._cleanup', err);
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Bootstrap
	//
	// Entry point. Creates the App and calls init() either immediately (if the
	// DOM is already parsed) or after DOMContentLoaded. Wrapped in try/catch so
	// a fatal startup error is logged clearly rather than silently swallowed.
	// ---------------------------------------------------------------------------

	function initializeApp() {
		try {
			const app = new App();
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', () => app.init());
			} else {
				app.init();
			}
		} catch (err) {
			console.error(`${CONFIG.SCRIPT_NAME}: fatal error during startup:`, err);
		}
	}

	initializeApp();

})();