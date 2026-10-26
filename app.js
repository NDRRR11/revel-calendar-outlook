function getPref(name, defaultVal) {
    if (typeof gadgets !== 'undefined' && gadgets.prefs) {
        var val = gadgets.prefs.getString(name);
        if (val) return val;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || defaultVal;
}

async function loadCalendar() {
    const icsUrl = getPref('icsUrl', '');
    const mode = getPref('mode', 'weekly');
    const maxDays = parseInt(getPref('maxDays', '7'));

    document.documentElement.style.setProperty('--bg-color', getPref('bgColor', 'rgba(0,0,0,0.5)'));
    document.documentElement.style.setProperty('--text-color', getPref('textColor', '#ffffff'));
    document.documentElement.style.setProperty('--font-size', getPref('fontSize', '16') + 'px');

    if (!icsUrl) {
        document.getElementById('calendar-events').innerHTML = '<div class="event-item">Please provide an Outlook ICS URL.</div>';
        return;
    }

    try {
        // CORS proxy utilized for browser/player fetching compatibility
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(icsUrl)}`;
        const response = await fetch(proxyUrl);
        const data = await response.text();

        const jcalData = ICAL.parse(data);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        const now = new Date();
        const events = [];

        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            const startDate = event.startDate.toJSDate();

            if (startDate >= now) {
                events.push({
                    title: event.summary,
                    startDate: startDate,
                    timeString: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    dateString: startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
                });
            }
        });

        events.sort((a, b) => a.startDate - b.startDate);
        render(events, mode, maxDays);
    } catch (err) {
        console.error(err);
        document.getElementById('calendar-events').innerHTML = '<div class="event-item">Error loading calendar feed.</div>';
    }
}

function render(events, mode, maxDays) {
    const container = document.getElementById('calendar-events');
    const header = document.getElementById('calendar-header');
    container.innerHTML = '';

    if (events.length === 0) {
        container.innerHTML = '<div class="event-item">No upcoming meetings.</div>';
        return;
    }

    if (mode === 'daily') {
        header.textContent = "Today's Featured Meeting";
        const ev = events[0];
        container.innerHTML = `
            <div class="event-item daily-view">
                <div class="event-name">${ev.title}</div>
                <div class="event-time">${ev.timeString}</div>
                <div class="event-date">${ev.dateString}</div>
            </div>
        `;
    } else {
        header.textContent = "Upcoming Schedule";
        const filtered = events.filter(ev => (ev.startDate - new Date()) / (1000 * 60 * 60 * 24) <= maxDays);
        
        filtered.forEach(ev => {
            const div = document.createElement('div');
            div.className = 'event-item weekly-view';
            div.innerHTML = `
                <div class="event-date">${ev.dateString}</div>
                <div class="event-time">${ev.timeString}</div>
                <div class="event-name">${ev.title}</div>
            `;
            container.appendChild(div);
        });
    }
}

loadCalendar();
setInterval(loadCalendar, 15 * 60 * 1000); // Refresh every 15 mins
