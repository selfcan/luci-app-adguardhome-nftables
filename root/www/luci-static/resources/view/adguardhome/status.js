'use strict';
'require baseclass';
'require poll';
'require rpc';
'require fs';
'require uci';

var callCoreInfo = rpc.declare({
	object: 'luci.adguardhome',
	method: 'getCoreInfo',
	expect: { '': {} },
	reject: true
});

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name', 'verbose' ],
	expect: { '': {} },
	reject: true
});

var loadConfigPromise;

function getConfiguredBinPath() {
	if (!loadConfigPromise)
		loadConfigPromise = uci.load('AdGuardHome').catch(function() { return null; });

	return loadConfigPromise.then(function() {
		return uci.get('AdGuardHome', 'AdGuardHome', 'binpath') || '/usr/bin/AdGuardHome/AdGuardHome';
	});
}

function coreIsRunning(services, binpath) {
	var instances = services.AdGuardHome && services.AdGuardHome.instances;
	if (!instances)
		return false;

	return Object.keys(instances).some(function(name) {
		var instance = instances[name];
		return instance.running === true && Array.isArray(instance.command) && instance.command[0] === binpath;
	});
}

return baseclass.extend({
	render: function() {
		var badgeStyle = 'display:inline-flex;align-items:center;padding:0.4em 0.8em;' +
			'border:1px solid;border-radius:999px;font-weight:600;line-height:1.4;';
		var coreBadge = E('span', { 'style': badgeStyle }, _('Collecting data...'));
		var serviceBadge = E('span', { 'style': badgeStyle }, _('Collecting data...'));
		var redirectBadge = E('span', { 'style': badgeStyle }, _('Collecting data...'));
		var node = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:0.6em;padding:0.6em;' }, [
				coreBadge, serviceBadge, redirectBadge
			])
		]);

		function setBadge(badge, label, state) {
			badge.textContent = label;
			badge.style.backgroundColor = state === true ? '#dcfce7' : state === false ? '#fee2e2' : '#e5e7eb';
			badge.style.color = state === true ? '#14532d' : state === false ? '#7f1d1d' : '#374151';
			badge.style.borderColor = state === true ? '#86efac' : state === false ? '#fca5a5' : '#d1d5db';
		}

		function refreshCore() {
			return callCoreInfo().then(function(info) {
				if (!info.core_exists)
					setBadge(coreBadge, _('Core') + ': ' + _('no core'), false);
				else if (!info.version)
					setBadge(coreBadge, _('Core') + ': ' + _('core error'), false);
				else if (!info.config_exists)
					setBadge(coreBadge, _('Core') + ': ' + info.version + ' (' + _('no config') + ')', false);
				else
					setBadge(coreBadge, _('Core') + ': ' + info.version, true);
			}).catch(function() {
				setBadge(coreBadge, _('Core') + ': ' + _('Status unavailable'), null);
			});
		}

		refreshCore();
		poll.add(function() {
			var redirectFlag = fs.read('/var/run/AdGredir').catch(function(error) {
				if (error.name === 'NotFoundError')
					return '';
				throw error;
			});

			return Promise.all([getConfiguredBinPath(), callServiceList('AdGuardHome', true), redirectFlag]).then(function(results) {
				var isRunning = coreIsRunning(results[1], results[0]);
				setBadge(serviceBadge, 'AdGuardHome: ' + (isRunning ? _('RUNNING') : _('NOT RUNNING')), isRunning);
				setBadge(redirectBadge, _('Redirect') + ': ' + (results[2].trim() === '1' ? _('Redirected') : _('Not redirect')),
					results[2].trim() === '1');
			}).catch(function() {
				setBadge(serviceBadge, _('Status unavailable'), null);
				setBadge(redirectBadge, _('Status unavailable'), null);
			});
		}, 3);

		return { node: node, refresh: refreshCore };
	}
});