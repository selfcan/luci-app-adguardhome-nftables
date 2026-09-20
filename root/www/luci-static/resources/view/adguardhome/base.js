'use strict';
'require view';
'require form';
'require poll';
'require rpc';
'require fs';
'require uci';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name', 'verbose' ],
	expect: { '': {} },
	reject: true
});

function coreIsRunning(services, binpath) {
	var instances = services.AdGuardHome && services.AdGuardHome.instances;
	if (!instances)
		return false;

	return Object.keys(instances).some(function(name) {
		var instance = instances[name];
		return instance.running === true && Array.isArray(instance.command) &&
			instance.command[0] === binpath;
	});
}

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('AdGuardHome');

		s = m.section(
			form.TypedSection,
			'AdGuardHome',
			_('Basic Settings')
		);

		s.anonymous = true;
		s.addremove = false;

		o = s.option(
			form.Flag,
			'enabled',
			_('Enable')
		);
		o.default = '0';
		o.rmempty = false;

		o = s.option(
			form.Value,
			'httpport',
			_('Browser management port')
		);
		o.datatype = 'port';
		o.placeholder = '3000';
		o.default = '3000';
		o.rmempty = false;

		o = s.option(
			form.ListValue,
			'redirect',
			_('Redirect mode'),
			_('AdGuardHome redirect mode')
		);

		o.value('none', _('None'));
		o.value('dnsmasq-upstream', _('Run as dnsmasq upstream server'));
		o.value('redirect', _('Redirect port 53 to AdGuardHome'));
		o.value('exchange', _('Use port 53 instead of dnsmasq'));

		o.default = 'none';
		o.rmempty = false;

		o = s.option(
			form.DynamicList,
			'wan_ifname',
			_('WAN Interface'),
			_('Only effective in redirect mode, bypass specified interfaces to avoid becoming a public DNS resolver')
		);
		o.datatype = 'string';
		o.rmempty = true;

		o = s.option(
			form.Value,
			'binpath',
			_('Bin Path'),
			_('AdGuardHome binary path')
		);
		o.default = '/usr/bin/AdGuardHome/AdGuardHome';
		o.rmempty = false;

		o = s.option(
			form.Value,
			'configpath',
			_('Config Path'),
			_('AdGuardHome config path')
		);
		o.default = '/etc/AdGuardHome.yaml';
		o.rmempty = false;

		o = s.option(
			form.Value,
			'workdir',
			_('Work dir'),
			_('AdGuardHome work dir including rules, audit log and database')
		);
		o.default = '/usr/bin/AdGuardHome';
		o.rmempty = false;

		o = s.option(
			form.Value,
			'logfile',
			_('Runtime log file'),
			_('If set to "syslog", write to system log; if empty, disable file logging')
		);
		o.rmempty = true;

		o = s.option(
			form.Flag,
			'verbose',
			_('Verbose log')
		);
		o.default = '0';
		o.rmempty = true;

		return m.render().then(function(node) {
			var badgeStyle = 'display:inline-flex;align-items:center;padding:0.4em 0.8em;' +
				'border:1px solid;border-radius:999px;font-weight:600;line-height:1.4;';
			var serviceBadge = E('span', { 'style': badgeStyle }, _('Collecting data...'));
			var redirectBadge = E('span', { 'style': badgeStyle }, _('Collecting data...'));
			var statusBox = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('AdGuardHome Status')),
				E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:0.6em;padding:0.6em 0;' }, [
					serviceBadge,
					redirectBadge
				])
			]);

			function setBadge(badge, label, state) {
				badge.textContent = label;
				badge.style.backgroundColor = state === true ? '#dcfce7' :
					state === false ? '#fee2e2' : '#e5e7eb';
				badge.style.color = state === true ? '#14532d' :
					state === false ? '#7f1d1d' : '#374151';
				badge.style.borderColor = state === true ? '#86efac' :
					state === false ? '#fca5a5' : '#d1d5db';
			}

			setBadge(serviceBadge, _('Collecting data...'), null);
			setBadge(redirectBadge, _('Collecting data...'), null);
			node.insertBefore(statusBox, node.firstChild);

			var portInput = node.querySelector('[data-name="httpport"] input');
			var portField = node.querySelector('[data-name="httpport"] .cbi-value-field');
			if (portInput && portField) {
				var webLink = E('input', {
					'type': 'button',
					'style': 'width:210px;border-color:Teal;text-align:center;font-weight:bold;color:#337ab7;background:#ffc800;',
					'target': '_blank',
					'value': _('AdGuardHome Web')
				});
				var linkWrap = E('div', { 'style': 'margin-top:0.6em;' }, webLink);
				var host = window.location.hostname;
				if (host.indexOf(':') >= 0 && host.charAt(0) !== '[')
					host = '[' + host + ']';

				function updateWebLink() {
					var port = portInput.value.trim();
					var valid = /^[0-9]+$/.test(port) && +port >= 1 && +port <= 65535;
					webLink.value = _('AdGuardHome Web') + ': ' + port;
					webLink.onclick = valid ? function() {
						window.open('http://' + host + ':' + port + '/');
					} : null;
					webLink.style.display = valid ? 'inline-block' : 'none';
				}

				portField.appendChild(linkWrap);
				portInput.addEventListener('input', updateWebLink);
				updateWebLink();
			}

			poll.add(function() {
				var binpath = uci.get('AdGuardHome', 'AdGuardHome', 'binpath') ||
					'/usr/bin/AdGuardHome/AdGuardHome';
				var redirectFlag = fs.read('/var/run/AdGredir').catch(function(error) {
					if (error.name === 'NotFoundError')
						return '';
					throw error;
				});

				return Promise.all([callServiceList('AdGuardHome', true), redirectFlag])
					.then(function(results) {
						var running = coreIsRunning(results[0], binpath);
						var redirected = results[1].trim() === '1';

						setBadge(serviceBadge,
							'AdGuardHome: ' + (running ? _('RUNNING') : _('NOT RUNNING')),
							running);
						setBadge(redirectBadge,
							_('Redirect') + ': ' + (redirected ? _('Redirected') : _('Not redirect')),
							redirected);
					})
					.catch(function() {
						setBadge(serviceBadge, _('Status unavailable'), null);
						setBadge(redirectBadge, _('Status unavailable'), null);
					});
			}, 3);

			return node;
		});
	}
});