'use strict';
'require view';
'require form';
'require request';

return view.extend({
        render: function() {
                let m, s, o;

                m = new form.Map(
                        'AdGuardHome',
                        _('AdGuard Home JS'),
                        _('Free and open source, powerful network-wide ads & trackers blocking DNS server.')
                );

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

                o = s.option(
                        form.MultiValue,
                        'upprotect',
                        _('Keep files when system upgrade')
                );

                o.value('$binpath', _('Core binary'));
                o.value('$configpath', _('Config file'));
                o.widget = 'checkbox';
                o.rmempty = true;

                o = s.option(
                        form.Flag,
                        'waitonboot',
                        _('On boot when network is ready restart')
                );
                o.default = '1';
                o.rmempty = true;

                return m.render().then(function(node) {
                        var statusText = E('p', {}, _('Collecting data...'));
                        var statusBox = E('div', { 'class': 'cbi-section' }, [
                                E('h3', {}, _('AdGuardHome Status')),
                                statusText
                        ]);

                        node.insertBefore(statusBox, node.firstChild);

                        request.poll.add(
                                3,
                                L.url('admin', 'services', 'AdGuardHome', 'status'),
                                {},
                                function(response, data) {
                                        if (!data || typeof data.running !== 'boolean') {
                                                statusText.textContent = _('Status unavailable');
                                                return;
                                        }

                                        statusText.textContent =
                                                (data.running ? _('Running') : _('Not running')) +
                                                ' · ' +
                                                (data.redirect ? _('Redirected') : _('Not redirected'));
                                }
                        );

                        return node;
                });
        }
});