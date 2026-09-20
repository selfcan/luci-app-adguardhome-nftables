module("luci.controller.AdGuardHome", package.seeall)
local fs = require "nixio.fs"
local http = require "luci.http"
local uci = require"luci.model.uci".cursor()
function index()
local page = entry({"admin", "services", "AdGuardHome"},alias("admin", "services", "AdGuardHome", "base"),_("AdGuard Home"))
page.order = 11
page.dependent = true
page.acl_depends = { "luci-app-adguardhome" }
    entry({"admin", "services", "AdGuardHome", "manual"}, cbi("AdGuardHome/manual"), _("Manual Config"), 3).leaf = true
    entry({"admin", "services", "AdGuardHome", "reloadconfig"}, call("reload_config"))
    entry({"admin", "services", "AdGuardHome", "gettemplateconfig"}, call("get_template_config"))
end
function get_template_config()
	local template_file = "/usr/share/AdGuardHome/AdGuardHome_template.yaml"
	local content = ""
	if fs.access(template_file) then
		content = fs.readfile(template_file) or ""
	end
	http.prepare_content("text/plain; charset=utf-8")
	http.write(content)
end
function reload_config()
	fs.remove("/tmp/AdGuardHometmpconfig.yaml")
	http.prepare_content("application/json")
	http.write('')
end
