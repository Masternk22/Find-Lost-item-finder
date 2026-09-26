document.addEventListener('DOMContentLoaded', () => {
    const page = location.pathname.split('/').pop() || 'Home.html';
    const storageKeys = {
        users: 'founder_users',
        admins: 'founder_admins',
        session: 'founder_session',
        reports: 'founder_reports',
        claims: 'founder_claims',
        items: 'founder_items'
    };
    const defaultSearchItems = [];
    const removedSearchItemTitles = new Set([
        'Graphing Calculator',
        'Black Laptop Bag',
        'Dell Laptop',
        'Student ID',
        'Casio Calculator',
        'Apple AirPods'
    ]);
    const protectedPages = {
        user: ['userdash.html', 'Reportlost.html', 'Reportfound.html'],
        admin: ['Admindash.html']
    };

    function goTo(url) {
        window.location.href = url;
    }

    function readJson(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) || fallback;
        } catch {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function escapeSvgText(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function titleImageDataUri(item = {}) {
        const accent = item.status === 'Lost' ? '#002a5d' : '#115cb9';
        const tint = item.status === 'Lost' ? '#d7e2ff' : '#d8e7ff';
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560" role="img" aria-label="Generic item illustration">
                <defs>
                    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#f7f9ff"/>
                        <stop offset="100%" stop-color="#e9eefc"/>
                    </linearGradient>
                </defs>
                <rect width="900" height="560" fill="url(#bg)"/>
                <rect x="56" y="56" width="788" height="448" rx="34" fill="#ffffff" stroke="#c3c6d2" stroke-width="3"/>
                <circle cx="450" cy="206" r="92" fill="${tint}"/>
                <rect x="360" y="328" width="180" height="18" rx="9" fill="#d7dbe8"/>
                <rect x="330" y="362" width="240" height="18" rx="9" fill="#d7dbe8"/>
                <rect x="294" y="396" width="312" height="18" rx="9" fill="#d7dbe8"/>
                <rect x="372" y="168" width="156" height="76" rx="22" fill="${accent}" opacity="0.16"/>
                <circle cx="450" cy="206" r="38" fill="${accent}" opacity="0.8"/>
            </svg>
        `;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function normalizedImageKey(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function localImageForItem(item = {}) {
        const title = normalizedImageKey(item.title || item.itemName);
        const category = normalizedImageKey(item.cat || item.category);

        if (title === 'black laptop bag') {
            return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80';
        }
        if (title === 'dell laptop') {
            return 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80';
        }
        if (title === 'student id') {
            return 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1200&q=80';
        }
        if (title === 'casio calculator') {
            return 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=1200&q=80';
        }
        if (title === 'apple airpods') {
            return 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=1200&q=80';
        }

        if (/(calculator|presenter|laptop|airpods|headphones|phone|iphone|tablet|computer)/.test(title)) {
            return 'assets/images/electronics.svg';
        }
        if (/(id badge|student id|access card|employee id|documents?|badge)/.test(title) || /(documents?)/.test(category)) {
            return 'assets/images/documents.svg';
        }
        if (/(stethoscope|blood pressure|monitor heart|lab coat|scrubs|medical|hospital)/.test(title) || /(hospital|medical)/.test(category)) {
            return 'assets/images/hospital.svg';
        }
        if (/(keyboard|briefcase|lamp|watch|wallet|accessory|work bag|laptop bag)/.test(title) || /(office|bags|luggage)/.test(category)) {
            return 'assets/images/office.svg';
        }
        if (/(book|textbook|blueprints|stationery|study|calculator|notes)/.test(title) || /(study|college|stationery)/.test(category)) {
            return 'assets/images/study.svg';
        }
        if (/(map|review|report|photo|hero)/.test(title)) {
            return 'assets/images/map.svg';
        }
        return 'assets/images/hero-found.svg';
    }

    function imageSrcForItem(item = {}) {
        if (String(item.src || '').startsWith('data:image/')) return item.src;
        return item.itemPhoto || item.photoData || item.photo || localImageForItem(item) || titleImageDataUri(item);
    }

    function isRemovedSearchItem(item = {}) {
        return removedSearchItemTitles.has(String(item.title || item.itemName || '').trim());
    }

    function seedItems() {
        const existing = readJson(storageKeys.items, null);
        if (Array.isArray(existing) && existing.length) {
            const filtered = existing.filter((item) => !isRemovedSearchItem(item));
            if (filtered.length !== existing.length) writeJson(storageKeys.items, filtered);
            return filtered;
        }
        writeJson(storageKeys.items, []);
        return [];
    }

    function getStoredItems() {
        return seedItems();
    }

    function saveStoredItems(items) {
        writeJson(storageKeys.items, items);
    }

    function getSession() {
        return readJson(storageKeys.session, null);
    }

    function setSession(role, account) {
        writeJson(storageKeys.session, {
            role,
            name: account.name || account.adminName || account.email || account.adminId,
            email: account.email || '',
            adminId: account.adminId || '',
            phone: account.phone || '',
            department: account.department || account.organization || ''
        });
    }

    function clearSession() {
        localStorage.removeItem(storageKeys.session);
    }

    function showLocalToast(message) {
        const existingToast = document.getElementById('toast');
        if (existingToast && typeof window.showToast === 'function') {
            window.showToast(message, 'success');
            return;
        }

        let toast = document.getElementById('site-action-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'site-action-toast';
            toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-white px-5 py-3 rounded-lg shadow-xl text-sm font-semibold opacity-0 translate-y-4 transition-all duration-300';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.remove('opacity-0', 'translate-y-4');
        setTimeout(() => toast.classList.add('opacity-0', 'translate-y-4'), 2200);
    }

    function loginUrl(nextPage, mode = 'user') {
        const params = new URLSearchParams();
        params.set('mode', mode);
        if (nextPage) params.set('next', nextPage);
        return `Login.html?${params.toString()}`;
    }

    function dashboardFor(role) {
        return role === 'admin' ? 'Admindash.html' : 'userdash.html';
    }

    function renameBrand() {
        document.title = 'Lost & Found Items';
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const textNodes = [];

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach((node) => {
            const parentTag = node.parentElement?.tagName;
            if (parentTag === 'SCRIPT' || parentTag === 'STYLE') return;
            if (node.nodeValue.includes('Founder')) {
                node.nodeValue = node.nodeValue.replaceAll('Founder', 'Lost & Found Items');
            }
        });
    }

    function headerLinkClass(targetPage) {
        const isActive = page === targetPage;
        return isActive
            ? "font-label-lg text-primary relative h-full flex items-center after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary"
            : 'font-label-lg text-on-surface-variant hover:text-primary transition-colors py-2';
    }

    function addSharedHeader() {
        if (page === 'Login.html') return;

        const session = getSession();
        const dashboardHref = session ? dashboardFor(session.role) : 'userdash.html';
        const existingTop = document.body.firstElementChild;

        if (existingTop && ['NAV', 'HEADER'].includes(existingTop.tagName)) {
            existingTop.remove();
        }

        const nav = document.createElement('nav');
        nav.className = 'fixed top-0 w-full z-50 glass-nav h-20 bg-white/70 backdrop-blur-[20px] border-b border-white/80 shadow-sm shadow-primary/5';
        nav.innerHTML = `
            <div class="max-w-container-max-width mx-auto px-margin-desktop flex items-center justify-between h-full">
                <div class="flex items-center gap-12">
                    <span class="font-headline-sm text-headline-sm font-bold text-primary tracking-tight">Lost & Found Items</span>
                    <div class="hidden md:flex gap-8 items-center h-full">
                        <a class="${headerLinkClass('Home.html')}" href="Home.html">Home</a>
                        <a class="${headerLinkClass('Items&search.html')}" href="Items&search.html">Search</a>
                        ${session?.role === 'admin' ? '' : `<a class="${headerLinkClass('Reportlost.html')}" href="Reportlost.html">Report Lost</a>
                        <a class="${headerLinkClass('Reportfound.html')}" href="Reportfound.html">Report Found</a>`}
                        <a class="${headerLinkClass(dashboardHref)}" href="${dashboardHref}">Dashboard</a>
                    </div>
                </div>
                <div class="flex items-center gap-6">
                    <div class="hidden lg:flex relative">
                        <input class="bg-surface-container-low border-none rounded-full px-6 py-2 focus:ring-2 focus:ring-primary/20 w-64 text-body-sm transition-all placeholder:text-outline" placeholder="Search items..." type="text">
                        <span class="material-symbols-outlined absolute right-3 top-2 text-outline">search</span>
                    </div>
                    <button onclick="window.location.href='Login.html'" class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-primary/5 transition-all active:scale-95" type="button">
                        <span class="material-symbols-outlined text-primary text-[28px]">account_circle</span>
                    </button>
                </div>
            </div>
        `;

        document.body.insertBefore(nav, document.body.firstChild);

        const sidebar = document.body.querySelector('aside');
        if (sidebar) {
            sidebar.style.top = '5rem';
            sidebar.style.height = 'calc(100vh - 5rem)';
            sidebar.classList.remove('top-0', 'h-screen');
            sidebar.classList.add('top-20');
        }

        const main = document.body.querySelector('main');
        if (main) {
            main.classList.remove('pt-28', 'pt-32');
            if (!main.className.includes('mt-20') && !main.className.includes('pt-20')) {
                main.classList.add('pt-20');
            }
        }
    }

    function hideReportEntryPointsForAdmins() {
        const session = getSession();
        if (!session || session.role !== 'admin') return;

        document.querySelectorAll('a[href="Reportlost.html"], a[href="Reportfound.html"], button[onclick*="Reportlost.html"], button[onclick*="Reportfound.html"]').forEach((element) => {
            element.classList.add('hidden');
        });
    }

    function requiredRoleForUrl(url) {
        const targetPage = url.split('?')[0].split('#')[0];
        if (protectedPages.admin.includes(targetPage)) return 'admin';
        if (protectedPages.user.includes(targetPage)) return 'user';
        return null;
    }

    function canOpen(roleRequired, session) {
        if (!roleRequired) return true;
        if (!session) return false;
        return session.role === roleRequired;
    }

    function guardPage() {
        const session = getSession();

        if (protectedPages.admin.includes(page)) {
            if (!session) goTo(loginUrl(page, 'admin'));
            else if (session.role !== 'admin') goTo('userdash.html');
            return;
        }

        if (protectedPages.user.includes(page)) {
            if (!session) goTo(loginUrl(page, 'user'));
            else if (session.role !== 'user') goTo('Admindash.html');
            return;
        }
    }

    guardPage();
    renameBrand();
    addSharedHeader();
    hideReportEntryPointsForAdmins();
    populateUserDashboard();
    populateAdminDashboard();

    function updateDashboardLinks() {
        const session = getSession();
        if (!session) return;

        const dashboard = dashboardFor(session.role);
        const blockedDashboard = session.role === 'admin' ? 'userdash.html' : 'Admindash.html';

        document.querySelectorAll(`a[href="${blockedDashboard}"], a[href="${dashboard}"]`).forEach((link) => {
            link.href = dashboard;
        });

        document.querySelectorAll('button[onclick]').forEach((button) => {
            const action = button.getAttribute('onclick') || '';
            if (!action.includes(blockedDashboard) && !action.includes(dashboard)) return;
            button.setAttribute('onclick', `window.location.href='${dashboard}'`);
        });
    }

    updateDashboardLinks();

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        const button = event.target.closest('button[onclick]');
        const rawTarget = link?.getAttribute('href') || button?.getAttribute('onclick')?.match(/['"]([^'"]+\.html[^'"]*)['"]/)?.[1];
        if (!rawTarget) return;

        const roleRequired = requiredRoleForUrl(rawTarget);
        if (!roleRequired) return;

        const session = getSession();
        if (canOpen(roleRequired, session)) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (!session) {
            const loginMode = roleRequired === 'admin' ? 'admin' : 'user';
            showLocalToast('Please login first. Register if you do not have an account.');
            setTimeout(() => goTo(loginUrl(rawTarget, loginMode)), 350);
            return;
        }

        showLocalToast(session.role === 'admin' ? 'Admin accounts use the admin dashboard.' : 'User accounts use the user dashboard.');
        setTimeout(() => goTo(dashboardFor(session.role)), 350);
    }, true);

    window.handleSiteSearch = function handleSiteSearch(input) {
        const query = input.value.trim();
        if (page === 'Items&search.html') {
            if (typeof window.applyItemFilters === 'function') {
                window.applyItemFilters();
            }
            return;
        }

        goTo(query ? `Items&search.html?q=${encodeURIComponent(query)}` : 'Items&search.html');
    };

    document.querySelectorAll('input[placeholder*="Search"], input[placeholder*="search"]').forEach((input) => {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                window.handleSiteSearch(input);
            }
        });

        const icon = input.parentElement?.querySelector('.material-symbols-outlined');
        if (icon && icon.textContent.trim() === 'search') {
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', () => window.handleSiteSearch(input));
        }
    });

    document.querySelectorAll('button.material-symbols-outlined, button .material-symbols-outlined').forEach((buttonOrIcon) => {
        const button = buttonOrIcon.tagName === 'BUTTON' ? buttonOrIcon : buttonOrIcon.closest('button');
        if (!button || button.dataset.passwordToggleBound) return;

        const text = button.textContent.trim();
        if (text !== 'visibility' && text !== 'visibility_off') return;

        const input = button.parentElement?.querySelector('input[type="password"], input[type="text"]');
        if (!input) return;

        button.dataset.passwordToggleBound = 'true';
        button.type = 'button';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            button.textContent = isPassword ? 'visibility_off' : 'visibility';
        });
    });

    function getFormValues(formId) {
        const form = document.getElementById(formId);
        const inputs = Array.from(form?.querySelectorAll('input') || []);
        return inputs.map((input) => input.value.trim());
    }

    function validEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function getLoginNext(role) {
        return 'Home.html';
    }

    function currentAccount() {
        const session = getSession();
        if (!session) return null;

        const key = session.role === 'admin' ? storageKeys.admins : storageKeys.users;
        const accounts = readJson(key, []);
        const account = accounts.find((item) => {
            if (session.role === 'admin') {
                return item.email === session.email || item.adminId === session.adminId;
            }
            return item.email === session.email;
        });

        return {
            role: session.role,
            account: account || session
        };
    }

    function saveReport(report) {
        const session = getSession();
        if (!session) return null;

        const reports = readJson(storageKeys.reports, []);
        const savedReport = {
            id: `report-${Date.now()}`,
            ownerEmail: session.email,
            ownerRole: session.role,
            createdAt: new Date().toISOString(),
            status: 'Pending Review',
            ...report
        };
        reports.push(savedReport);
        writeJson(storageKeys.reports, reports);
        return savedReport;
    }

    function saveClaim(claim) {
        const session = getSession();
        if (!session) return;

        const claims = readJson(storageKeys.claims, []);
        claims.push({
            id: `claim-${Date.now()}`,
            ownerEmail: session.email,
            ownerRole: session.role,
            createdAt: new Date().toISOString(),
            status: 'In Review',
            ...claim
        });
        writeJson(storageKeys.claims, claims);
    }

    function userRecords(type) {
        const session = getSession();
        if (!session) return [];

        const key = type === 'claims' ? storageKeys.claims : storageKeys.reports;
        return readJson(key, []).filter((item) => item.ownerEmail === session.email);
    }

    function accountByEmail(email) {
        const users = readJson(storageKeys.users, []);
        const admins = readJson(storageKeys.admins, []);
        return users.find((user) => user.email === email) || admins.find((admin) => admin.email === email) || null;
    }

    function saveCurrentAccount(updates) {
        const session = getSession();
        if (!session) return;

        const key = session.role === 'admin' ? storageKeys.admins : storageKeys.users;
        const accounts = readJson(key, []);
        const index = accounts.findIndex((item) => {
            if (session.role === 'admin') {
                return item.email === session.email || item.adminId === session.adminId;
            }
            return item.email === session.email;
        });

        const updated = { ...(index >= 0 ? accounts[index] : session), ...updates };
        if (index >= 0) {
            accounts[index] = updated;
        } else {
            accounts.push(updated);
        }

        writeJson(key, accounts);
        setSession(session.role, updated);
    }

    function valueOrBlank(value) {
        return value && value.trim() ? value.trim() : 'Not provided';
    }

    function adminContactDetails(record = {}) {
        const details = currentAccount();
        const admins = readJson(storageKeys.admins, []);
        const savedAdmin = admins.find((admin) => {
            return (record.reviewedByEmail && admin.email === record.reviewedByEmail)
                || (record.reviewedByAdminId && admin.adminId === record.reviewedByAdminId);
        }) || (admins.length === 1 ? admins[0] : null);
        const account = savedAdmin || (details?.role === 'admin' ? details.account : null);
        return {
            name: account?.name || record.reviewedByName || account?.email || 'Admin',
            email: account?.email || record.reviewedByEmail || '',
            phone: account?.phone || record.reviewedByPhone || '',
            adminId: account?.adminId || record.reviewedByAdminId || ''
        };
    }

    function contactPhoneDigits(phone) {
        return String(phone || '').replace(/\D/g, '');
    }

    function waLinkForAdmin(admin, record) {
        const phoneDigits = contactPhoneDigits(admin.phone);
        if (!phoneDigits) return '';

        const itemName = record?.itemName || record?.title || 'your claim';
        const message = encodeURIComponent(`Hello ${admin.name || 'Admin'}, I am contacting you about the approved claim for "${itemName}".`);
        return `https://wa.me/${phoneDigits}?text=${message}`;
    }

    function mailLinkForAdmin(admin, record) {
        if (!admin.email) return '';

        const itemName = record?.itemName || record?.title || 'your claim';
        const subject = encodeURIComponent(`Approved claim follow-up for ${itemName}`);
        const body = encodeURIComponent(`Hello ${admin.name || 'Admin'},\n\nI am contacting you about the approved claim for "${itemName}". Please let me know the next steps for pickup or verification.\n\nThank you.`);
        return `mailto:${admin.email}?subject=${subject}&body=${body}`;
    }

    function approvedContactNotice(record, label = 'record') {
        if (record.status !== 'Approved') return '';

        const admin = adminContactDetails(record);
        const whatsappUrl = waLinkForAdmin(admin, record);
        const emailUrl = mailLinkForAdmin(admin, record);
        const showActions = label === 'claim';
        return `
            <div class="mt-stack-md rounded-lg border border-secondary/20 bg-secondary/10 p-stack-md">
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-secondary bg-white/70 p-2 rounded-lg">verified_user</span>
                    <div>
                        <p class="font-label-lg text-label-lg text-secondary">Approved ${label}</p>
                        <p class="font-body-sm text-body-sm text-on-surface-variant">Please contact the admin for pickup and final verification.</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-stack-sm">
                            ${detailRow('Admin Name', admin.name)}
                            ${detailRow('Admin Email', admin.email)}
                            ${detailRow('Admin Phone', admin.phone)}
                            ${detailRow('Admin ID', admin.adminId)}
                        </div>
                        ${showActions ? `
                        <div class="flex flex-wrap gap-3 mt-stack-md">
                            <a class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white font-label-lg hover:bg-green-600 transition-all ${whatsappUrl ? '' : 'pointer-events-none opacity-50'}" href="${whatsappUrl || '#'}" ${whatsappUrl ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                                <span class="material-symbols-outlined text-[18px]">chat</span>
                                WhatsApp
                            </a>
                            <a class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-label-lg hover:bg-primary-container transition-all ${emailUrl ? '' : 'pointer-events-none opacity-50'}" href="${emailUrl || '#'}" ${emailUrl ? '' : 'aria-disabled="true" tabindex="-1"'} >
                                <span class="material-symbols-outlined text-[18px]">mail</span>
                                Email
                            </a>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function setTextByLabel(labelText, value) {
        const labels = Array.from(document.querySelectorAll('label'));
        const label = labels.find((item) => item.textContent.trim().toLowerCase() === labelText.toLowerCase());
        const output = label?.parentElement?.querySelector('p');
        if (output) output.textContent = valueOrBlank(value);
    }

    function populateUserDashboard() {
        if (page !== 'userdash.html') return;

        const details = currentAccount();
        if (!details) return;

        const account = details.account;
        const name = account.name || account.email || 'User';
        const email = account.email || 'Not provided';
        const phone = account.phone || '';
        const department = account.department || account.organization || '';

        const welcomeTitle = document.querySelector('header h1');
        const welcomeEmail = document.querySelector('header p');
        const avatar = document.querySelector('a[href="userdash.html"] span');
        const avatarImage = document.querySelector('a[href="userdash.html"] img');

        if (welcomeTitle) welcomeTitle.textContent = `Welcome back, ${name}`;
        if (welcomeEmail) welcomeEmail.textContent = email;
        if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
        if (avatarImage) avatarImage.alt = `${name} profile avatar`;

        setTextByLabel('Full Name', name);
        setTextByLabel('Email Address', email);
        setTextByLabel('Phone Number', phone);
        setTextByLabel('Organization/Department', department);
        renderUserActivity();
    }

    function findDashboardCard(title) {
        return Array.from(document.querySelectorAll('h3')).find((heading) => heading.textContent.trim() === title)?.closest('.glass-card');
    }

    function formatDate(value) {
        if (!value) return 'Recently';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function renderRecordList(card, records, emptyText, actionLabel, actionHref) {
        if (!card) return;

        const badge = card.querySelector('.rounded-full');
        if (badge) badge.textContent = `${records.length} ${records.length === 1 ? 'Item' : 'Items'}`;

        const list = card.querySelector('.space-y-stack-sm');
        if (!list) return;

        const rows = records.slice(-3).reverse().map((record) => `
            <div class="p-stack-sm bg-surface-container-lowest/60 rounded-lg border border-outline-variant/30">
                <div class="flex items-center justify-between gap-3">
                    <span class="font-label-lg text-label-lg text-on-surface truncate">${record.itemName || record.title || 'Untitled item'}</span>
                    <span class="font-label-sm text-label-sm text-outline whitespace-nowrap">${formatDate(record.createdAt)}</span>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${record.location || record.category || record.status || ''}</p>
                <p class="font-label-sm text-label-sm text-secondary font-semibold">${record.status || 'Pending Review'}</p>
            </div>
        `).join('');

        list.innerHTML = rows || `<p class="font-body-sm text-body-sm text-on-surface-variant">${emptyText}</p>`;
        list.insertAdjacentHTML('beforeend', `<button onclick="window.location.href='${actionHref}'" class="w-full py-2 font-label-md text-label-md text-primary border border-primary/20 rounded-lg hover:bg-primary/5 liquid-transition">${actionLabel}</button>`);
    }

    function renderUserActivity() {
        if (page !== 'userdash.html') return;

        const reports = userRecords('reports');
        const lostReports = reports.filter((report) => report.reportType === 'lost');
        const foundReports = reports.filter((report) => report.reportType === 'found');
        const claims = userRecords('claims');

        renderRecordList(findDashboardCard('My Lost Reports'), lostReports, 'No lost reports yet.', 'Report Lost Item', 'Reportlost.html');
        renderRecordList(findDashboardCard('My Found Reports'), foundReports, 'No found reports yet.', 'Report Found Item', 'Reportfound.html');
        renderRecordList(findDashboardCard('My Claims'), claims, 'No claims submitted yet.', 'Find Items', 'Items&search.html');
        renderActivityDetails(reports, claims);
    }

    function detailRow(label, value) {
        return `
            <div>
                <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">${label}</span>
                <p class="font-body-sm text-body-sm text-on-surface">${valueOrBlank(value)}</p>
            </div>
        `;
    }

    function reportDetailCard(report) {
        const typeLabel = report.reportType === 'found' ? 'Found Report' : 'Lost Report';
        return `
            <article class="bg-surface-container-lowest/70 border border-outline-variant/30 rounded-lg p-stack-md">
                <div class="flex items-center justify-between gap-3 mb-stack-md">
                    <div>
                        <p class="font-label-sm text-label-sm text-primary uppercase tracking-wider">${typeLabel}</p>
                        <h3 class="font-headline-sm text-headline-sm text-on-surface">${valueOrBlank(report.itemName)}</h3>
                    </div>
                    <span class="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">${valueOrBlank(report.status)}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
                    ${detailRow('Category', report.category)}
                    ${detailRow('Location', report.location)}
                    ${detailRow('Date', report.date || formatDate(report.createdAt))}
                    ${detailRow('Reporter', report.reporterName)}
                    ${detailRow('Phone', report.reporterPhone)}
                    ${detailRow('Email', report.reporterEmail)}
                </div>
                <div class="mt-stack-md">
                    ${detailRow('Description', report.description)}
                </div>
                ${approvedContactNotice(report, 'report')}
            </article>
        `;
    }

    function claimDetailCard(claim) {
        return `
            <article class="bg-surface-container-lowest/70 border border-outline-variant/30 rounded-lg p-stack-md">
                <div class="flex items-center justify-between gap-3 mb-stack-md">
                    <div>
                        <p class="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Claim</p>
                        <h3 class="font-headline-sm text-headline-sm text-on-surface">${valueOrBlank(claim.itemName)}</h3>
                    </div>
                    <span class="px-3 py-1 rounded-full bg-secondary/10 text-secondary font-label-sm text-label-sm">${valueOrBlank(claim.status)}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
                    ${detailRow('Category', claim.category)}
                    ${detailRow('Location', claim.location)}
                    ${detailRow('Claimed On', formatDate(claim.createdAt))}
                    ${detailRow('Claimant', claim.claimantName)}
                    ${detailRow('Phone', claim.claimantPhone)}
                    ${detailRow('Email', claim.claimantEmail)}
                </div>
                ${approvedContactNotice(claim, 'claim')}
            </article>
        `;
    }

    function renderActivityDetails(reports, claims) {
        const anchor = document.querySelector('section.grid');
        if (!anchor) return;

        let section = document.getElementById('user-activity-details');
        if (!section) {
            section = document.createElement('section');
            section.id = 'user-activity-details';
            section.className = 'mt-stack-lg';
            anchor.insertAdjacentElement('afterend', section);
        }

        const reportCards = reports.slice().reverse().map(reportDetailCard).join('');
        const claimCards = claims.slice().reverse().map(claimDetailCard).join('');

        section.innerHTML = `
            <div class="glass-card p-stack-lg rounded-lg">
                <div class="flex items-center justify-between mb-stack-lg">
                    <div class="flex items-center space-x-3">
                        <span class="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">assignment</span>
                        <h2 class="font-headline-sm text-headline-sm text-on-surface">My Saved Activity</h2>
                    </div>
                </div>
                <div class="space-y-stack-md">
                    ${reportCards || claimCards ? `${reportCards}${claimCards}` : '<p class="font-body-sm text-body-sm text-on-surface-variant">No reports or claims saved yet.</p>'}
                </div>
            </div>
        `;
    }

    function addAdminProfileCard() {
        if (page !== 'Admindash.html') return;

        const overview = document.getElementById('overview-view');
        if (!overview || document.getElementById('admin-profile-card')) return;

        const card = document.createElement('section');
        card.id = 'admin-profile-card';
        card.className = 'mt-stack-lg mb-stack-lg';
        card.innerHTML = `
            <div class="glass-panel p-stack-lg rounded-lg">
                <div class="flex items-center justify-between mb-stack-lg">
                    <div class="flex items-center space-x-3">
                        <span class="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">admin_panel_settings</span>
                        <h2 class="font-headline-sm text-headline-sm text-on-surface">Admin Profile Details</h2>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-gutter gap-y-stack-md">
                    <div class="space-y-1">
                        <label class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Admin Name</label>
                        <p class="admin-profile-name font-body-md text-body-md text-on-surface font-medium">Not provided</p>
                    </div>
                    <div class="space-y-1">
                        <label class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Email Address</label>
                        <p class="admin-profile-email font-body-md text-body-md text-on-surface font-medium">Not provided</p>
                    </div>
                    <div class="space-y-1">
                        <label class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Admin ID</label>
                        <p class="admin-profile-id font-body-md text-body-md text-on-surface font-medium">Not provided</p>
                    </div>
                    <div class="space-y-1">
                        <label class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Phone Number</label>
                        <p class="admin-profile-phone font-body-md text-body-md text-on-surface font-medium">Not provided</p>
                    </div>
                    <div class="space-y-1">
                        <label class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Organization/Department</label>
                        <p class="admin-profile-department font-body-md text-body-md text-on-surface font-medium">Not provided</p>
                    </div>
                </div>
            </div>
        `;

        overview.appendChild(card);
    }

    function populateAdminDashboard() {
        if (page !== 'Admindash.html') return;

        addAdminProfileCard();
        renderManagedItems();
        syncSearchInventoryForAdmin();
        renderAdminApprovalQueues();
        const details = currentAccount();
        if (!details) return;

        const account = details.account;
        const name = account.name || account.email || account.adminId || 'Admin';
        const email = account.email || '';
        const adminId = account.adminId || '';
        const phone = account.phone || '';
        const department = account.department || account.organization || '';

        const title = document.getElementById('view-subtitle');
        if (title) title.textContent = `Welcome back, ${name}. Here's the latest platform activity.`;

        const set = (selector, value) => {
            const element = document.querySelector(selector);
            if (element) element.textContent = valueOrBlank(value);
        };

        set('.admin-profile-name', name);
        set('.admin-profile-email', email);
        set('.admin-profile-id', adminId);
        set('.admin-profile-phone', phone);
        set('.admin-profile-department', department);
    }

    function syncSearchInventoryForAdmin() {
        if (page !== 'Admindash.html' || document.getElementById('search-inventory-sync-frame')) return;

        const frame = document.createElement('iframe');
        frame.id = 'search-inventory-sync-frame';
        frame.src = 'Items&search.html';
        frame.title = 'Search inventory sync';
        frame.className = 'hidden';
        frame.onload = () => {
            renderManagedItems();
            setTimeout(() => frame.remove(), 300);
        };
        document.body.appendChild(frame);
    }

    function managedItemsTableBody() {
        return document.querySelector('#manage-items-view tbody');
    }

    function renderManagedItems() {
        if (page !== 'Admindash.html') return;

        const tbody = managedItemsTableBody();
        if (!tbody) return;

        const tableWrap = tbody.closest('.overflow-x-auto');
        if (tableWrap) {
            tableWrap.classList.add('managed-items-scroll');
            tableWrap.style.maxHeight = '60vh';
            tableWrap.style.overflow = 'auto';
        }

        const items = getStoredItems();
        tbody.innerHTML = items.map((item) => {
            const statusClass = item.status === 'Found'
                ? 'bg-secondary-container/10 text-secondary border-secondary/10'
                : 'bg-primary-container/10 text-primary border-primary/10';
            return `
                <tr class="hover:bg-surface-container-low/50 transition-colors" data-item-id="${item.id}">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <img alt="${item.title}" class="w-10 h-10 rounded bg-surface-variant object-cover" src="${imageSrcForItem(item)}">
                            <div>
                                <span class="font-medium text-on-surface block">${item.title}</span>
                                <span class="text-label-sm text-outline">${item.loc}</span>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-on-surface-variant">${item.cat}</td>
                    <td class="px-6 py-4 text-on-surface-variant">${item.reporter || 'System'}</td>
                    <td class="px-6 py-4 text-outline">${item.date}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 rounded-full ${statusClass} text-label-sm font-semibold border">${item.status}</span></td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex justify-end gap-1">
                            <button class="admin-edit-item p-2 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" type="button" data-item-id="${item.id}">
                                <span class="material-symbols-outlined">edit</span>
                            </button>
                            <button class="admin-delete-item p-2 text-error hover:bg-error-container/10 rounded-lg transition-colors" type="button" data-item-id="${item.id}">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const summary = document.querySelector('#manage-items-view .p-6.border-t p');
        if (summary) summary.textContent = `Showing ${items.length} managed items`;

        const foundCount = items.filter((item) => item.status === 'Found').length;
        const lostCount = items.filter((item) => item.status === 'Lost').length;
        const foundTab = document.getElementById('tab-found-items');
        const lostTab = document.getElementById('tab-lost-items');
        if (foundTab) foundTab.textContent = `Found Items (${foundCount})`;
        if (lostTab) lostTab.textContent = `Lost Items (${lostCount})`;

        const statCards = document.querySelectorAll('#manage-items-view .glass-panel h3');
        if (statCards[0]) statCards[0].textContent = String(items.length);
        if (statCards[1]) {
            const since = Date.now() - 24 * 60 * 60 * 1000;
            const recentCount = items.filter((item) => {
                if (!item.reportId) return false;
                const sourceReport = readJson(storageKeys.reports, []).find((report) => report.id === item.reportId);
                return sourceReport?.createdAt && Date.parse(sourceReport.createdAt) >= since;
            }).length;
            statCards[1].textContent = String(recentCount);
        }

        tbody.querySelectorAll('.admin-edit-item').forEach((button) => {
            button.addEventListener('click', () => editManagedItem(button.dataset.itemId));
        });
        tbody.querySelectorAll('.admin-delete-item').forEach((button) => {
            button.addEventListener('click', () => deleteManagedItem(button.dataset.itemId));
        });
    }

    window.renderManagedItemsFromStorage = renderManagedItems;

    function editManagedItem(itemId) {
        const items = getStoredItems();
        const index = items.findIndex((item) => item.id === itemId);
        if (index < 0) return;

        const item = items[index];
        const title = prompt('Item name', item.title);
        if (title === null) return;
        const cat = prompt('Category', item.cat);
        if (cat === null) return;
        const loc = prompt('Location', item.loc);
        if (loc === null) return;
        const status = prompt('Status: Found or Lost', item.status);
        if (status === null) return;
        const date = prompt('Date', item.date);
        if (date === null) return;

        const cleanStatus = status.trim().toLowerCase() === 'lost' ? 'Lost' : 'Found';
        items[index] = {
            ...item,
            title: title.trim() || item.title,
            cat: cat.trim() || item.cat,
            loc: loc.trim() || item.loc,
            status: cleanStatus,
            date: date.trim() || item.date
        };

        saveStoredItems(items);
        renderManagedItems();
        showLocalToast('Item details updated.');
    }

    function deleteManagedItem(itemId) {
        const item = getStoredItems().find((entry) => entry.id === itemId);
        if (!item) return;
        if (!confirm(`Delete "${item.title}" from managed items?`)) return;

        saveStoredItems(getStoredItems().filter((entry) => entry.id !== itemId));
        renderManagedItems();
        showLocalToast('Item deleted.');
    }

    function statusBadge(status) {
        const normalized = status || 'Pending Review';
        const classes = normalized === 'Approved'
            ? 'bg-secondary/10 text-secondary border-secondary/20'
            : normalized === 'Rejected'
                ? 'bg-error-container text-error border-error/20'
                : 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary-fixed-dim/30';
        return `<span class="inline-flex px-3 py-1 rounded-full border ${classes} font-label-sm text-label-sm">${normalized}</span>`;
    }

    function reporterContactForClaim(claim) {
        const reports = readJson(storageKeys.reports, []);
        const reportId = claim.reportId || String(claim.itemId || '').replace('report-item-', '');
        const report = reports.find((item) => item.id === reportId || item.id === claim.reportId);
        const owner = accountByEmail(report?.ownerEmail || claim.itemOwnerEmail || claim.reporterEmail);

        return {
            name: claim.itemReporter || report?.reporterName || owner?.name || report?.ownerEmail || '',
            email: claim.itemReporterEmail || report?.reporterEmail || report?.ownerEmail || owner?.email || '',
            phone: claim.itemReporterPhone || report?.reporterPhone || owner?.phone || '',
            source: report?.reportType === 'lost' ? 'Reported User' : 'Uploaded User'
        };
    }

    function showClaimApprovalContactCard(claim) {
        if (page !== 'Admindash.html') return;

        document.getElementById('claim-approval-contact-card')?.remove();
        const reporter = reporterContactForClaim(claim);
        const admin = adminContactDetails(claim);

        const card = document.createElement('div');
        card.id = 'claim-approval-contact-card';
        card.className = 'fixed inset-0 z-[1100] flex items-start justify-center bg-black/20 px-4 pt-24';
        card.innerHTML = `
            <div class="w-full max-w-md rounded-xl border border-outline-variant/30 bg-white shadow-2xl p-stack-lg">
                <div class="flex items-start justify-between gap-4 mb-stack-md">
                    <div>
                        <p class="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Claim Approved</p>
                        <h3 class="font-headline-sm text-headline-sm text-on-surface">${valueOrBlank(claim.itemName)}</h3>
                    </div>
                    <button class="p-2 rounded-lg hover:bg-surface-container-low transition-colors" type="button" aria-label="Close contact card">
                        <span class="material-symbols-outlined text-on-surface-variant">close</span>
                    </button>
                </div>
                <div class="space-y-stack-md">
                    <div class="rounded-lg bg-secondary/10 border border-secondary/20 p-stack-md">
                        <p class="font-label-lg text-label-lg text-secondary mb-2">${reporter.source}</p>
                        <div class="grid grid-cols-1 gap-3">
                            ${detailRow('Name', reporter.name)}
                            ${detailRow('Email', reporter.email)}
                            ${detailRow('Phone', reporter.phone)}
                        </div>
                    </div>
                    <div class="rounded-lg bg-primary/5 border border-primary/15 p-stack-md">
                        <p class="font-label-lg text-label-lg text-primary mb-2">Claimant</p>
                        <div class="grid grid-cols-1 gap-3">
                            ${detailRow('Name', claim.claimantName)}
                            ${detailRow('Email', claim.claimantEmail || claim.ownerEmail)}
                            ${detailRow('Phone', claim.claimantPhone)}
                        </div>
                    </div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant">Share the admin contact with the approved user for final pickup: ${valueOrBlank(admin.email)}${admin.phone ? `, ${admin.phone}` : ''}.</p>
                </div>
            </div>
        `;
        card.querySelector('button')?.addEventListener('click', () => card.remove());
        card.addEventListener('click', (event) => {
            if (event.target === card) card.remove();
        });
        document.body.appendChild(card);
    }

    function renderAdminReportCard(report) {
        const user = accountByEmail(report.ownerEmail);
        const userName = user?.name || report.reporterName || report.ownerEmail || 'Unknown user';
        return `
            <article class="glass-panel rounded-xl p-5 border border-outline-variant/30" data-record-id="${report.id}">
                <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div class="space-y-2">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-label-sm text-label-sm uppercase tracking-wider text-primary">${report.reportType === 'found' ? 'Found Report' : 'Lost Report'}</span>
                            ${statusBadge(report.status)}
                        </div>
                        <h3 class="font-headline-sm text-headline-sm text-on-surface">${valueOrBlank(report.itemName)}</h3>
                        <p class="font-body-sm text-body-sm text-on-surface-variant">${valueOrBlank(report.description)}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="admin-record-action px-5 py-2 border border-outline-variant text-on-surface-variant font-label-lg rounded-lg hover:bg-surface-container-low transition-all" data-type="report" data-item-type="${report.reportType}" data-id="${report.id}" data-action="Rejected" type="button">Reject</button>
                        <button class="admin-record-action px-5 py-2 bg-primary text-white font-label-lg rounded-lg hover:bg-primary-container transition-all shadow-sm" data-type="report" data-item-type="${report.reportType}" data-id="${report.id}" data-action="Approved" type="button">Approve</button>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-outline-variant/20">
                    ${detailRow('User', userName)}
                    ${detailRow('User Email', report.ownerEmail)}
                    ${detailRow('User Phone', user?.phone || report.reporterPhone)}
                    ${detailRow('Reporter Name', report.reporterName)}
                    ${detailRow('Reporter Email', report.reporterEmail)}
                    ${detailRow('Reporter Phone', report.reporterPhone)}
                    ${detailRow('Category', report.category)}
                    ${detailRow('Location', report.location)}
                    ${detailRow('Date', report.date || formatDate(report.createdAt))}
                </div>
            </article>
        `;
    }

    function renderAdminClaimCard(claim) {
        const user = accountByEmail(claim.ownerEmail);
        const userName = user?.name || claim.claimantName || claim.ownerEmail || 'Unknown user';
        const itemStatusClass = claim.itemStatus === 'Lost'
            ? 'bg-primary-container/10 text-primary border-primary/10'
            : 'bg-secondary-container/10 text-secondary border-secondary/10';
        return `
            <article class="glass-panel rounded-xl p-5 border border-outline-variant/30" data-record-id="${claim.id}">
                <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div class="flex gap-4">
                        <img alt="${valueOrBlank(claim.itemName)}" class="w-24 h-24 rounded-lg bg-surface-variant object-cover border border-outline-variant/30 flex-shrink-0" src="${imageSrcForItem({ title: claim.itemName, cat: claim.itemCategory, status: claim.itemStatus, src: claim.itemPhoto })}">
                        <div class="space-y-2">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Claim Request</span>
                                ${statusBadge(claim.status)}
                                <span class="inline-flex px-3 py-1 rounded-full border ${itemStatusClass} font-label-sm text-label-sm">${valueOrBlank(claim.itemStatus || 'Found')}</span>
                            </div>
                            <h3 class="font-headline-sm text-headline-sm text-on-surface">${valueOrBlank(claim.itemName)}</h3>
                            <p class="font-body-sm text-body-sm text-on-surface-variant">${valueOrBlank(claim.location)}</p>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5 pt-5 border-t border-outline-variant/20">
                    <div>
                        <h4 class="font-label-lg text-label-lg text-primary mb-3">Item Details</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${detailRow('Item Name', claim.itemName)}
                            ${detailRow('Category', claim.category)}
                            ${detailRow('Status', claim.itemStatus)}
                            ${detailRow('Location', claim.location)}
                            ${detailRow('Item Date', claim.itemDate)}
                            ${detailRow('Reported By', claim.itemReporter)}
                            ${detailRow('Description', claim.itemDescription)}
                        </div>
                    </div>
                    <div>
                        <h4 class="font-label-lg text-label-lg text-primary mb-3">User Details</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${detailRow('Logged-in User', userName || claim.userName)}
                            ${detailRow('User Email', claim.userEmail || claim.ownerEmail)}
                            ${detailRow('User Phone', user?.phone || claim.userPhone)}
                            ${detailRow('Claimant Name', claim.claimantName)}
                            ${detailRow('Claimant Email', claim.claimantEmail)}
                            ${detailRow('Claimant Phone', claim.claimantPhone)}
                            ${detailRow('Requested On', formatDate(claim.createdAt))}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function ensureQueueContainer(viewId, title, subtitle) {
        const view = document.getElementById(viewId);
        if (!view) return null;

        view.innerHTML = `
            <div class="mb-stack-lg">
                <h3 class="font-headline-sm text-headline-sm text-primary">${title}</h3>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${subtitle}</p>
            </div>
            <div class="space-y-stack-md admin-queue-list"></div>
        `;

        return view.querySelector('.admin-queue-list');
    }

    function renderOverviewClaims(claims) {
        const section = Array.from(document.querySelectorAll('#overview-view section')).find((candidate) => {
            return candidate.textContent.includes('Recent Claims for Approval');
        });
        const list = section?.querySelector('.divide-y');
        if (!list) return;

        const pendingClaims = claims.filter((claim) => claim.status !== 'Approved' && claim.status !== 'Rejected').slice(-3).reverse();
        list.className = 'divide-y divide-outline-variant/10';
        list.innerHTML = pendingClaims.length ? pendingClaims.map((claim) => {
            const user = accountByEmail(claim.ownerEmail);
            return `
                <div class="p-6 flex flex-col lg:flex-row lg:items-center gap-5 hover:bg-surface-container-low transition-colors">
                    <img alt="${valueOrBlank(claim.itemName)}" class="w-16 h-16 rounded-lg bg-surface-variant object-cover border border-outline-variant/30 flex-shrink-0" src="${imageSrcForItem({ title: claim.itemName, cat: claim.itemCategory, status: claim.itemStatus, src: claim.itemPhoto })}">
                    <div class="flex-grow">
                        <h4 class="font-label-lg text-on-surface text-lg">${valueOrBlank(claim.itemName)}</h4>
                        <p class="text-body-sm text-on-surface-variant mt-1">Claimed by <span class="text-primary font-medium">${valueOrBlank(claim.claimantName || user?.name)}</span> &bull; ${formatDate(claim.createdAt)}</p>
                        <p class="text-label-sm text-outline mt-1">${valueOrBlank(claim.claimantEmail || claim.ownerEmail)} &middot; ${valueOrBlank(claim.claimantPhone || user?.phone)} &middot; ${valueOrBlank(claim.location)}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="admin-record-action px-5 py-2 border border-outline-variant text-on-surface-variant font-label-lg rounded-lg hover:bg-surface-container-low transition-all" data-type="claim" data-id="${claim.id}" data-action="Rejected" type="button">Reject</button>
                        <button class="admin-record-action px-5 py-2 bg-primary text-white font-label-lg rounded-lg hover:bg-primary-container transition-all shadow-sm" data-type="claim" data-id="${claim.id}" data-action="Approved" type="button">Approve</button>
                    </div>
                </div>
            `;
        }).join('') : '<div class="p-6 text-on-surface-variant font-body-sm">No pending claims yet.</div>';
    }

    function renderAdminApprovalQueues() {
        if (page !== 'Admindash.html') return;

        const reports = readJson(storageKeys.reports, []);
        const claims = readJson(storageKeys.claims, []);
        const reportList = ensureQueueContainer('reported-view', 'Reports for Approval', 'Lost and found reports submitted by users.');
        const claimList = ensureQueueContainer('claimed-view', 'Claimed History', 'Approved and rejected claim records.');
        const resolvedClaims = claims.filter((claim) => claim.status === 'Approved' || claim.status === 'Rejected');

        if (reportList) {
            reportList.innerHTML = reports.length
                ? reports.slice().reverse().map(renderAdminReportCard).join('')
                : '<div class="glass-panel rounded-xl p-8 text-center text-on-surface-variant">No user reports submitted yet.</div>';
        }

        if (claimList) {
            claimList.innerHTML = resolvedClaims.length
                ? resolvedClaims.slice().reverse().map(renderAdminClaimCard).join('')
                : '<div class="glass-panel rounded-xl p-8 text-center text-on-surface-variant">No approved or rejected claims yet.</div>';
        }

        renderOverviewClaims(claims);
        document.querySelectorAll('.admin-record-action').forEach((button) => {
            button.addEventListener('click', () => updateAdminRecordStatus(button.dataset.type, button.dataset.id, button.dataset.action, button.dataset.itemType));
        });
    }

    function canUseServerAdminAction() {
        return window.location.protocol === 'http:' || window.location.protocol === 'https:';
    }

    async function postAdminActionToServer(type, id, status, itemType = '') {
        if (!canUseServerAdminAction()) return null;

        const formData = new FormData();
        formData.append('type', type);
        formData.append('id', id);
        formData.append('action', status);
        formData.append('item_type', itemType);

        const response = await fetch('/admin/action', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'fetch'
            },
            body: formData
        });

        // A missing Flask backend often shows up as a 404/HTML page when this
        // static checkout is served over Live Server. Treat that as "no server"
        // so the localStorage fallback can still approve/reject records.
        if (response.status === 404) return null;

        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok === false) {
            throw new Error(result.message || 'Unable to update admin record.');
        }
        return result;
    }

    async function updateAdminRecordStatus(type, id, status, itemType = '') {
        try {
            const serverResult = await postAdminActionToServer(type, id, status, itemType);
            if (serverResult) {
                showLocalToast(serverResult.message || `${type === 'claim' ? 'Claim' : 'Report'} ${status.toLowerCase()}.`);
                window.location.reload();
                return;
            }
        } catch (error) {
            const message = String(error?.message || '');
            const isAuthError = /log in first|access to this page/i.test(message);
            if (isAuthError) {
                showLocalToast(error.message || 'Unable to update the claim status right now.');
                return;
            }
            // Any other server problem should still allow the static/localStorage
            // workflow to keep working.
        }

        const key = type === 'claim' ? storageKeys.claims : storageKeys.reports;
        const records = readJson(key, []);
        const index = records.findIndex((record) => String(record.id) === String(id));
        if (index < 0) return;

        const admin = adminContactDetails();
        records[index] = {
            ...records[index],
            status,
            reviewedAt: new Date().toISOString(),
            ...(status === 'Approved' ? {
                reviewedByName: admin.name,
                reviewedByEmail: admin.email,
                reviewedByPhone: admin.phone,
                reviewedByAdminId: admin.adminId
            } : {})
        };
        writeJson(key, records);

        if (type === 'report' && status === 'Approved') {
            addApprovedReportToItems(records[index]);
        }

        renderAdminApprovalQueues();
        renderManagedItems();
        if (type === 'claim' && status === 'Approved') {
            showClaimApprovalContactCard(records[index]);
        }
        showLocalToast(`${type === 'claim' ? 'Claim' : 'Report'} ${status.toLowerCase()}.`);
    }

    function reportToSearchItem(report) {
        const isFound = report.reportType === 'found';
        return {
            id: `report-item-${report.id}`,
            title: report.itemName || 'User submitted item',
            cat: report.category || 'Uncategorized',
            icon: isFound ? 'inventory' : 'report_problem',
            loc: report.location || report.landmark || 'Not provided',
            status: isFound ? 'Found' : 'Lost',
            date: report.date || formatDate(report.createdAt),
            reporter: report.reporterName || report.ownerEmail || 'User',
            reporterEmail: report.reporterEmail || report.ownerEmail || '',
            reporterPhone: report.reporterPhone || '',
            ownerEmail: report.ownerEmail || '',
            src: report.photoData || report.photo || localImageForItem({
                title: report.itemName,
                cat: report.category,
                status: report.type === 'lost' ? 'Lost' : 'Found',
                icon: report.type === 'lost' ? 'search' : 'inventory_2'
            }),
            description: report.description || '',
            reportId: report.id
        };
    }

    function upsertReportItem(report) {
        if (!report?.id) return;
        const items = getStoredItems();
        const item = reportToSearchItem(report);
        const existingIndex = items.findIndex((entry) => entry.id === item.id || entry.reportId === report.id);

        if (existingIndex >= 0) {
            items[existingIndex] = { ...items[existingIndex], ...item };
        } else {
            items.unshift(item);
        }
        saveStoredItems(items);
    }

    function addApprovedReportToItems(report) {
        const items = getStoredItems();
        const item = reportToSearchItem(report);
        const existingIndex = items.findIndex((entry) => entry.id === item.id || entry.reportId === report.id);

        if (existingIndex >= 0) {
            items[existingIndex] = item;
        } else {
            items.unshift(item);
        }
        saveStoredItems(items);
    }

    function editProfile() {
        if (page === 'Admindash.html') {
            showLocalToast('Profile editing is not available on the admin dashboard.');
            return;
        }

        const details = currentAccount();
        if (!details) return;

        const account = details.account;
        const updates = {};

        const name = prompt('Full name', account.name || '');
        if (name === null) return;
        updates.name = name.trim();

        const email = prompt('Email address', account.email || '');
        if (email === null) return;
        if (!validEmail(email.trim())) {
            showLocalToast('Please enter a valid email address.');
            return;
        }
        updates.email = email.trim();

        if (details.role === 'admin') {
            const adminId = prompt('Admin ID', account.adminId || '');
            if (adminId === null) return;
            updates.adminId = adminId.trim();

            const phone = prompt('Phone number', account.phone || '');
            if (phone === null) return;
            updates.phone = phone.trim();
        } else {
            const phone = prompt('Phone number', account.phone || '');
            if (phone === null) return;
            updates.phone = phone.trim();
        }

        const department = prompt('Organization/Department', account.department || account.organization || '');
        if (department === null) return;
        updates.department = department.trim();

        saveCurrentAccount(updates);
        populateUserDashboard();
        populateAdminDashboard();
        showLocalToast('Profile updated.');
    }

    function registerUser() {
        const [name, email, phone, password, confirm] = getFormValues('form-user-register');
        if (!name || !email || !phone || !password || !confirm) {
            showLocalToast('Please fill all user registration fields.');
            return null;
        }
        if (!validEmail(email)) {
            showLocalToast('Please enter a valid user email.');
            return null;
        }
        if (password !== confirm) {
            showLocalToast('User passwords do not match.');
            return null;
        }

        const users = readJson(storageKeys.users, []);
        if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
            showLocalToast('This user is already registered. Please login.');
            window.toggleTab?.('user', 'login');
            return null;
        }

        const account = { name, email, phone, password, createdAt: new Date().toISOString() };
        users.push(account);
        writeJson(storageKeys.users, users);
        return { role: 'user', account };
    }

    function loginUser() {
        const [email, password] = getFormValues('form-user-login');
        if (!email || !password) {
            showLocalToast('Please enter your user email and password.');
            return null;
        }

        const users = readJson(storageKeys.users, []);
        const account = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
        if (!account) {
            showLocalToast('User not registered. Please register first.');
            window.toggleTab?.('user', 'register');
            return null;
        }
        if (account.password !== password) {
            showLocalToast('Incorrect user password.');
            return null;
        }

        setSession('user', account);
        return { role: 'user', account };
    }

    function registerAdmin() {
        const [name, email, phone, password, confirm, adminId] = getFormValues('form-admin-register');
        const cleanName = name.trim();
        const cleanEmail = email.trim();
        const cleanPhone = phone.trim();
        const cleanPassword = password.trim();
        const cleanConfirm = confirm.trim();
        const cleanAdminId = adminId.trim();

        if (!cleanName || !cleanEmail || !cleanPhone || !cleanPassword || !cleanConfirm || !cleanAdminId) {
            showLocalToast('Please fill all admin registration fields.');
            return null;
        }
        if (!validEmail(cleanEmail)) {
            showLocalToast('Please enter a valid admin email.');
            return null;
        }
        if (cleanPassword !== cleanConfirm) {
            showLocalToast('Admin passwords do not match.');
            return null;
        }

        const admins = readJson(storageKeys.admins, []);
        if (admins.some((admin) => String(admin.email || '').trim().toLowerCase() === cleanEmail.toLowerCase() || String(admin.adminId || '').trim().toLowerCase() === cleanAdminId.toLowerCase())) {
            showLocalToast('This admin is already registered. Please login.');
            window.toggleTab?.('admin', 'login');
            return null;
        }

        const account = { name: cleanName, email: cleanEmail, phone: cleanPhone, password: cleanPassword, adminId: cleanAdminId, createdAt: new Date().toISOString() };
        admins.push(account);
        writeJson(storageKeys.admins, admins);
        return { role: 'admin', account };
    }

    function loginAdmin() {
        const [idOrEmail, password] = getFormValues('form-admin-login');
        const cleanIdentity = idOrEmail.trim();
        const cleanPassword = password.trim();
        if (!cleanIdentity || !cleanPassword) {
            showLocalToast('Please enter your admin ID/email and password.');
            return null;
        }

        const admins = readJson(storageKeys.admins, []);
        const account = admins.find((admin) => {
            return String(admin.email || '').trim().toLowerCase() === cleanIdentity.toLowerCase()
                || String(admin.adminId || '').trim().toLowerCase() === cleanIdentity.toLowerCase();
        });
        if (!account) {
            showLocalToast('Admin not registered. Please register first.');
            window.toggleTab?.('admin', 'register');
            return null;
        }
        if (String(account.password || '').trim() !== cleanPassword) {
            showLocalToast('Incorrect admin password.');
            return null;
        }

        setSession('admin', account);
        return { role: 'admin', account };
    }

    window.simulateLoading = function simulateLoading(button) {
        const originalContent = button.innerHTML;
        const label = button.textContent.toLowerCase();
        const isAdmin = label.includes('admin');
        const isRegister = label.includes('register') || label.includes('create');
        const result = isAdmin
            ? (isRegister ? registerAdmin() : loginAdmin())
            : (isRegister ? registerUser() : loginUser());

        if (!result) return;

        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner"></div><span>Processing...</span>';

        setTimeout(() => {
            button.innerHTML = originalContent;
            button.disabled = false;
            if (isRegister) {
                showLocalToast('Account created successfully. Please login.');
                window.switchMode?.(result.role);
                window.toggleTab?.(result.role, 'login');
                return;
            }

            showLocalToast('Login successful.');
            setTimeout(() => goTo(getLoginNext(result.role)), 450);
        }, 600);
    };

    if (page === 'Login.html') {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if (mode === 'admin') {
            window.switchMode?.('admin');
            window.toggleTab?.('admin', 'login');
        } else {
            window.switchMode?.('user');
            window.toggleTab?.('user', 'login');
        }
    }

    if (page === 'Items&search.html' && typeof window.openClaimModal === 'function') {
        const originalOpenClaimModal = window.openClaimModal;
        window.openClaimModal = function guardedOpenClaimModal(index) {
            const session = getSession();
            if (!session) {
                showLocalToast('Please login as a user to claim an item.');
                setTimeout(() => goTo(loginUrl('Items&search.html', 'user')), 350);
                return;
            }
            window.currentClaimItemIndex = index;
            window.currentClaimItemId = getStoredItems()[index]?.id || '';
            originalOpenClaimModal(index);
        };

        if (typeof window.openClaimModalById === 'function') {
            const originalOpenClaimModalById = window.openClaimModalById;
            window.openClaimModalById = function guardedOpenClaimModalById(itemId) {
                const session = getSession();
                if (session?.role === 'admin') {
                    showLocalToast('Admin accounts cannot request item claims.');
                    return;
                }
                window.currentClaimItemId = itemId;
                const itemIndex = getStoredItems().findIndex((item) => item.id === itemId);
                window.currentClaimItemIndex = itemIndex;
                originalOpenClaimModalById(itemId);
            };
        }
    }

    function readValue(id) {
        return document.getElementById(id)?.value?.trim() || '';
    }

    function currentReportPhoto() {
        const preview = document.getElementById('photo-preview') || document.getElementById('review-photo') || document.getElementById('lost-photo-preview');
        const src = preview?.getAttribute('src') || window.founderReportPhotoData || '';
        return src.startsWith('data:image/') ? src : '';
    }

    function preparePhotoData(file, callback) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const originalData = event.target.result;
            const image = new Image();
            image.onload = () => {
                const maxSize = 1200;
                const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
                const width = Math.max(1, Math.round(image.width * scale));
                const height = Math.max(1, Math.round(image.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(image, 0, 0, width, height);
                callback(canvas.toDataURL('image/jpeg', 0.82));
            };
            image.onerror = () => callback(originalData);
            image.src = originalData;
        };
        reader.readAsDataURL(file);
    }

    window.founderPreparePhoto = preparePhotoData;

    function setLostPhoto(dataUrl) {
        window.founderReportPhotoData = dataUrl;

        let preview = document.getElementById('lost-photo-preview');
        const uploadBox = document.querySelector('#step-1 .border-dashed');
        if (!uploadBox) return;

        if (!preview) {
            uploadBox.classList.add('relative', 'overflow-hidden');
            preview = document.createElement('img');
            preview.id = 'lost-photo-preview';
            preview.alt = 'Uploaded item photo';
            preview.className = 'absolute inset-0 w-full h-full object-cover rounded-xl';
            uploadBox.appendChild(preview);
        }

        preview.src = dataUrl;
        uploadBox.querySelectorAll('span, p').forEach((element) => element.classList.add('hidden'));
    }

    function installLostPhotoUpload() {
        if (page !== 'Reportlost.html') return;

        const uploadBox = document.querySelector('#step-1 .border-dashed');
        if (!uploadBox || uploadBox.dataset.uploadReady === 'true') return;
        uploadBox.dataset.uploadReady = 'true';
        uploadBox.setAttribute('role', 'button');
        uploadBox.setAttribute('tabindex', '0');

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.className = 'hidden';
        uploadBox.appendChild(fileInput);

        const handleFile = (file) => {
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showLocalToast('Please upload a PNG or JPG image.');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showLocalToast('Please upload a photo smaller than 5MB.');
                return;
            }

            preparePhotoData(file, setLostPhoto);
        };

        uploadBox.addEventListener('click', () => fileInput.click());
        uploadBox.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInput.click();
            }
        });
        uploadBox.addEventListener('dragover', (event) => {
            event.preventDefault();
            uploadBox.classList.add('border-primary');
        });
        uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('border-primary'));
        uploadBox.addEventListener('drop', (event) => {
            event.preventDefault();
            uploadBox.classList.remove('border-primary');
            handleFile(event.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
    }

    function installReportStorageHooks() {
        if (page === 'Reportlost.html' && typeof window.submitForm === 'function') {
            const originalSubmitForm = window.submitForm;
            window.submitForm = function submitLostAndStore() {
                const report = saveReport({
                    reportType: 'lost',
                    itemName: readValue('item-name'),
                    category: readValue('item-category'),
                    description: readValue('item-desc'),
                    reporterName: readValue('reporter-name'),
                    reporterPhone: readValue('reporter-phone'),
                    reporterEmail: readValue('reporter-email'),
                    location: readValue('loc-address'),
                    landmark: readValue('loc-landmark'),
                    date: readValue('loc-date'),
                    time: readValue('loc-time'),
                    photoData: currentReportPhoto()
                });
                upsertReportItem(report);
                originalSubmitForm();
            };
        }

        if (page === 'Reportfound.html' && typeof window.showSuccess === 'function') {
            const originalShowSuccess = window.showSuccess;
            window.showSuccess = function submitFoundAndStore() {
                const report = saveReport({
                    reportType: 'found',
                    itemName: readValue('field-name'),
                    category: readValue('field-category'),
                    description: readValue('field-desc'),
                    reporterName: readValue('field-reporter-name'),
                    reporterPhone: readValue('field-reporter-phone'),
                    reporterEmail: readValue('field-reporter-email'),
                    location: readValue('field-location'),
                    date: readValue('field-date'),
                    photoData: currentReportPhoto()
                });
                upsertReportItem(report);
                originalShowSuccess();
            };
        }

        if (page === 'Items&search.html') {
            const confirmClaim = document.getElementById('confirm-claim');
            if (!confirmClaim) return;

            confirmClaim.addEventListener('click', () => {
                const session = getSession();
                const modalTitle = document.getElementById('modal-title')?.textContent.trim() || '';
                const modalCategory = document.getElementById('modal-cat')?.textContent.trim() || '';
                const modalLocation = document.getElementById('modal-loc')?.textContent.trim() || '';
                const modalDate = document.getElementById('modal-date')?.textContent.trim() || '';
                const modalStatus = document.getElementById('modal-status-badge')?.textContent.trim() || '';
                const modalPhoto = document.getElementById('modal-img')?.getAttribute('src') || '';

                if (!session || !modalTitle || confirmClaim.disabled) return;

                const storedItems = getStoredItems();
                const claimedItem = storedItems.find((item) => item.id === window.currentClaimItemId)
                    || storedItems[window.currentClaimItemIndex]
                    || storedItems.find((item) => item.title === modalTitle && item.loc === modalLocation)
                    || {};

                saveClaim({
                    itemId: claimedItem.id || window.currentClaimItemId || '',
                    itemName: modalTitle,
                    category: modalCategory,
                    location: modalLocation,
                    itemDate: modalDate,
                    itemStatus: claimedItem.status || modalStatus,
                    itemReporter: claimedItem.reporter || '',
                    itemReporterEmail: claimedItem.reporterEmail || claimedItem.ownerEmail || '',
                    itemReporterPhone: claimedItem.reporterPhone || '',
                    itemOwnerEmail: claimedItem.ownerEmail || '',
                    reportId: claimedItem.reportId || '',
                    itemPhoto: claimedItem.src || modalPhoto,
                    itemDescription: claimedItem.description || '',
                    claimantName: readValue('claim-name'),
                    claimantPhone: readValue('claim-phone'),
                    claimantEmail: readValue('claim-email'),
                    userName: session.name || '',
                    userEmail: session.email || '',
                    userPhone: session.phone || ''
                });
            });
        }
    }

    installLostPhotoUpload();
    installReportStorageHooks();

    const cancelFound = document.getElementById('btn-cancel');
    if (cancelFound && page === 'Reportfound.html') {
        cancelFound.addEventListener('click', () => goTo('Home.html'));
    }

    document.querySelectorAll('button').forEach((button) => {
        if (!button.textContent.trim().includes('Edit Profile')) return;
        button.addEventListener('click', editProfile);
    });

    document.querySelectorAll('a[href="Login.html"]').forEach((logoutLink) => {
        if (!logoutLink.textContent.toLowerCase().includes('logout')) return;
        logoutLink.addEventListener('click', () => clearSession());
    });
});
