module("luci.controller.AdGuardHome", package.seeall)
local fs = require "nixio.fs"
local http = require "luci.http"
local uci = require"luci.model.uci".cursor()
function index()
local page = entry({"admin", "services", "AdGuardHome"},alias("admin", "services", "AdGuardHome", "base"),_("AdGuard Home"))
page.order = 11
page.dependent = true
page.acl_depends = { "luci-app-adguardhome" }
    entry({"admin", "services", "AdGuardHome", "log"}, form("AdGuardHome/log"), _("Log"), 2).leaf = true
    entry({"admin", "services", "AdGuardHome", "manual"}, cbi("AdGuardHome/manual"), _("Manual Config"), 3).leaf = true
    entry({"admin", "services", "AdGuardHome", "getlog"}, call("get_log"))
    entry({"admin", "services", "AdGuardHome", "dodellog"}, call("do_dellog"))
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
function get_log()
	local logfile=uci:get("AdGuardHome","AdGuardHome","logfile")
	if (logfile==nil) then
		http.write("no log available\n")
		return
	elseif (logfile=="syslog") then
		if not fs.access("/var/run/AdGuardHomesyslog") then
			luci.sys.exec("(/usr/share/AdGuardHome/getsyslog.sh &); sleep 1;")
		end
		logfile="/tmp/AdGuardHometmp.log"
		fs.writefile("/var/run/AdGuardHomesyslog","1")
	elseif not fs.access(logfile) then
		http.write("")
		return
	end
	http.prepare_content("text/plain; charset=utf-8")
    local fdp = tonumber(fs.readfile("/var/run/lucilogpos")) or 0
	local f=io.open(logfile, "r+")
	f:seek("set",fdp)
	local a=f:read(2048000) or ""
	fdp=f:seek()
	fs.writefile("/var/run/lucilogpos",tostring(fdp))
	f:close()
	http.write(a)
end
function do_dellog()
	local logfile=uci:get("AdGuardHome","AdGuardHome","logfile")
	fs.writefile(logfile,"")
	http.prepare_content("application/json")
	http.write('')
end
