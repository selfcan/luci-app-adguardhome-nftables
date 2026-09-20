'use strict';
'require view';
'require form';
'require poll';
'require rpc';
'require view/adguardhome/status as status';

var callCoreInfo = rpc.declare({
	object: 'luci.adguardhome',
	method: 'getCoreInfo',
	expect: { '': {} },
	reject: true
});

var callInterfaces = rpc.declare({
	object: 'luci.adguardhome',
	method: 'getInterfaces',
	expect: { '': {} },
	reject: true
});

var callCoreUpdate = rpc.declare({
	object: 'luci.adguardhome',
	method: 'getCoreUpdate',
	expect: { '': {} },
	reject: true
});

var callStartCoreUpdate = rpc.declare({
	object: 'luci.adguardhome',
	method: 'startCoreUpdate',
	params: [ 'force' ],
	expect: { '': {} },
	reject: true
});

var callChangeWebPassword = rpc.declare({
	object: 'luci.adguardhome',
	method: 'changeWebPassword',
	params: [ 'hash' ],
	expect: { '': {} },
	reject: true
});

var bcryptLoader;

function loadBcrypt() {
	if (window.TwinBcrypt)
		return Promise.resolve(window.TwinBcrypt);

	if (!bcryptLoader) {
		bcryptLoader = new Promise(function(resolve, reject) {
			var script = document.createElement('script');
			script.src = L.resource('twin-bcrypt.min.js');
			script.onload = function() {
				if (window.TwinBcrypt)
					resolve(window.TwinBcrypt);
				else
					reject(new Error('bcrypt unavailable'));
			};
			script.onerror = reject;
			document.head.appendChild(script);
		}).catch(function(error) {
			bcryptLoader = null;
			throw error;
		});
	}

	return bcryptLoader;
}

return view.extend({
	load: function() {
		return Promise.all([
			callCoreInfo().catch(function() { return null; }),
			callInterfaces().catch(function() { return { interfaces: [] }; })
		]);
	},

	render: function(data) {
		let m, s, o;
		var coreInfo = data[0];
		var interfaces = data[1].interfaces || [];

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
		interfaces.filter(function(name) { return name !== 'lo'; }).forEach(function(name) {
			o.value(name, name);
		});

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
			var sharedStatus = status.render();

			var updateButton = E('button', {
				'class': 'btn cbi-button cbi-button-apply', 'type': 'button'
			}, _('Update core version'));
			var forceButton = E('button', {
				'class': 'btn cbi-button', 'type': 'button', 'style': 'margin-left:0.6em;'
			}, _('Force update'));
			var updateMessage = E('span', { 'style': 'margin-left:0.8em;' }, '');
			var reverseLog = E('input', { 'type': 'checkbox' });
			var updateLog = E('textarea', {
				'class': 'cbi-input-textarea', 'rows': 8, 'readonly': 'readonly',
				'style': 'display:none;width:100%;margin-top:0.6em;box-sizing:border-box;'
			});
			var logOptions = E('label', { 'style': 'display:none;margin-top:0.6em;' }, [
				reverseLog, ' ' + _('reverse')
			]);
			var updatePanel = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Upgrade Core')),
				E('div', { 'style': 'padding:0.6em;' }, [updateButton, forceButton, updateMessage]),
				logOptions, updateLog
			]);
			var lastLog = '';
			var startingAt = 0;
			var activeUpdate = false;
			var updateFinishedHere = false;

			function showLog() {
				updateLog.value = reverseLog.checked ? lastLog.split('\n').reverse().join('\n') : lastLog;
			}
			reverseLog.addEventListener('change', showLog);

			function showUpdateStatus(result) {
				var state = result.state || 'idle';
				if (startingAt && state === 'idle' && Date.now() - startingAt < 10000)
					return;
				startingAt = 0;
				if (state === 'running')
					activeUpdate = true;
				else if (activeUpdate && (state === 'finished' || state === 'failure')) {
					activeUpdate = false;
					updateFinishedHere = true;
					sharedStatus.refresh();
				}

				updateButton.disabled = forceButton.disabled = state === 'running';
				if (state === 'running' || updateFinishedHere) {
					updateMessage.textContent = state === 'running' ? _('Check...') :
						state === 'finished' ? _('Updated') : _('Update failed');
					lastLog = result.log || '';
					logOptions.style.display = updateLog.style.display = lastLog ? 'block' : 'none';
					showLog();
				} else {
					updateMessage.textContent = '';
					lastLog = '';
					logOptions.style.display = updateLog.style.display = 'none';
				}
			}

			function startUpdate(force) {
				startingAt = Date.now();
				activeUpdate = true;
				updateFinishedHere = false;
				updateButton.disabled = forceButton.disabled = true;
				updateMessage.textContent = _('Check...');
				lastLog = '';
				showLog();
				updateLog.style.display = logOptions.style.display = 'none';
				callStartCoreUpdate(force).then(function(result) {
					if (!result.started) {
						startingAt = 0;
						activeUpdate = false;
						updateMessage.textContent = _('Update in progress');
						return;
					}
					return callCoreUpdate().then(showUpdateStatus);
				}).catch(function() {
					startingAt = 0;
					activeUpdate = false;
					updateButton.disabled = forceButton.disabled = false;
					updateMessage.textContent = _('Unable to start update');
				});
			}

			updateButton.addEventListener('click', function() { startUpdate(false); });
			forceButton.addEventListener('click', function() { startUpdate(true); });
			poll.add(function() {
				return callCoreUpdate().then(showUpdateStatus).catch(function() {
					updateMessage.textContent = _('Update status unavailable');
				});
			}, 3);
			node.insertBefore(sharedStatus.node, node.firstChild);
			sharedStatus.node.parentNode.insertBefore(updatePanel, sharedStatus.node.nextSibling);

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

			var passwordInput = E('input', {
				'class': 'cbi-input-password', 'type': 'password',
				'autocomplete': 'new-password', 'spellcheck': 'false'
			});
			var passwordButton = E('button', {
				'class': 'btn cbi-button cbi-button-apply', 'type': 'button'
			}, _('Change password'));
			var passwordMessage = E('span', { 'style': 'margin-left:0.8em;' }, '');
			var passwordPanel = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Change browser management password')),
				E('div', { 'class': 'cbi-value', 'style': 'padding:0.6em 0;' }, [
					E('label', { 'class': 'cbi-value-title' }, _('New password')),
					E('div', { 'class': 'cbi-value-field' }, [
						passwordInput,
						E('span', { 'style': 'margin-left:0.6em;' }, passwordButton),
						passwordMessage
					])
				])
			]);

			passwordButton.addEventListener('click', function() {
				var password = passwordInput.value;
				if (!password) {
					passwordMessage.textContent = _('New password') + ' ' + _('is empty');
					return;
				}

				passwordButton.disabled = true;
				passwordMessage.textContent = _('Changing password...');
				loadBcrypt().then(function(bcrypt) {
					var hash = bcrypt.hashSync(password);
					password = null;
					passwordInput.value = '';
					return callChangeWebPassword(hash);
				}).then(function(result) {
					if (!result.changed)
						throw new Error(result.reason || 'change failed');
					passwordMessage.textContent = _('Password changed');
				}).catch(function() {
					passwordMessage.textContent = _('Password change failed');
				}).then(function() {
					passwordButton.disabled = false;
				});
			});
			node.appendChild(passwordPanel);

			return node;
		});
	}
});