'use strict';
'require view';
'require form';
'require request';

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
                        var badgeStyle = 'display:inline-flex;align-items:center;padding:0.4em 0.8em;' +
                                'border:1px solid;border-radius:999px;font-weight:600;line-height:1.4;';
                        var serviceBadge = E('span', { 'style': badgeStyle }, _('Collecting data...'));
                        var redirectBadge = E('span', { 'style': badgeStyle }, _('Collecting data...'));
                        var statusBox = E('div', { 'class': 'cbi-section' }, [
                                E('h3', {}, _('AdGuardHome Status')),
                                E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:0.6em;' }, [
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
                                var webLink = E('a', {
                                        'class': 'cbi-button cbi-button-action',
                                        'target': '_blank',
                                        'rel': 'noopener noreferrer'
                                }, _('Open AdGuardHome Web'));
                                var linkWrap = E('div', { 'style': 'margin-top:0.6em;' }, webLink);
                                var host = window.location.hostname;
                                if (host.indexOf(':') >= 0 && host.charAt(0) !== '[')
                                        host = '[' + host + ']';

                                function updateWebLink() {
                                        var port = portInput.value.trim();
                                        var valid = /^[0-9]+$/.test(port) && +port >= 1 && +port <= 65535;
                                        if (valid)
                                                webLink.href = 'http://' + host + ':' + port + '/';
                                        else
                                                webLink.removeAttribute('href');
                                        webLink.style.display = valid ? 'inline-block' : 'none';
                                }

                                portField.appendChild(linkWrap);
                                portInput.addEventListener('input', updateWebLink);
                                updateWebLink();
                        }

                        request.poll.add(
                                3,
                                L.url('admin', 'services', 'AdGuardHome', 'status'),
                                {},
                                function(response, data) {
                                        if (!data || typeof data.running !== 'boolean' ||
                                            typeof data.redirect !== 'boolean') {
                                                setBadge(serviceBadge, _('Status unavailable'), null);
                                                setBadge(redirectBadge, _('Status unavailable'), null);
                                                return;
                                        }

                                        setBadge(serviceBadge,
                                                'AdGuardHome: ' + (data.running ? _('RUNNING') : _('NOT RUNNING')),
                                                data.running);
                                        setBadge(redirectBadge,
                                                _('Redirect') + ': ' + (data.redirect ? _('Redirected') : _('Not redirect')),
                                                data.redirect);
                                }
                        );

                        return node;
                });
        }
});