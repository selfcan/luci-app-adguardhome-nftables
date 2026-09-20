require("luci.sys")
require("luci.util")
require("io")
local m,s,o,o1
local fs=require"nixio.fs"
local uci=require"luci.model.uci".cursor()
local configpath=uci:get("AdGuardHome","AdGuardHome","configpath") or "/etc/AdGuardHome.yaml"
local binpath = uci:get("AdGuardHome", "AdGuardHome", "binpath") or "/usr/bin/AdGuardHome/AdGuardHome"
httpport=uci:get("AdGuardHome","AdGuardHome","httpport") or "3000"
m = Map("AdGuardHome", "AdGuard Home")
m.description = translate("Free and open source, powerful network-wide ads & trackers blocking DNS server.")

s = m:section(TypedSection, "AdGuardHome")
s.anonymous=true
s.addremove=false
o = s:option(Flag, "enabled", translate("Enable"))
o.default = 0
o.optional = false
o =s:option(Value,"httpport",translate("Browser management port"))
o.placeholder=3000
o.default=3000
o.datatype="port"
o.optional = false
o.description = translate("<input type='button' style='width:210px;border-color:Teal;text-align:center;font-weight:bold;color:red;background: #ffc800;' value='AdGuardHome Web:" .. httpport .. "' onclick=\"window.open('http://'+window.location.hostname+':" .. httpport .. "')\"/>")
local binmtime=uci:get("AdGuardHome","AdGuardHome","binmtime") or "0"
local e=""
if not fs.access(configpath) then e = e .. " " .. translate("no config") end
if not fs.access(binpath) then
	e=e.." "..translate("no core")
else
	local version=uci:get("AdGuardHome","AdGuardHome","version")
	local testtime=fs.stat(binpath,"mtime")
	if testtime~=tonumber(binmtime) or version==nil then
        version = luci.sys.exec(string.format("echo -n $(%s --version 2>&1 | awk -F 'version ' '{print $2}' | awk -F ',' '{print $1}')", binpath))
        if version == "" then version = "core error" end
        uci:set("AdGuardHome", "AdGuardHome", "version", version)
        uci:set("AdGuardHome", "AdGuardHome", "binmtime", testtime)
        uci:commit("AdGuardHome")
	end
	e=version..e
end

o = s:option(Button, "restart", translate("Upgrade Core"))
o.inputtitle=translate("Update core version")
o.template = "AdGuardHome/AdGuardHome_check"
o.showfastconfig=(not fs.access(configpath))
o.description = string.format(translate("Current core version:") .. "<strong><font id='updateversion' style=\'color:green\'>%s </font></strong>", e)
local portcommand = "awk '/port:/ && ++count == 2 {sub(/[^0-9]+/, \"\", $2); printf(\"%s\\n\", $2); exit}' " .. configpath .. " 2>nul"
local port = luci.util.exec(portcommand)
if (port=="") then port="?" end
o = s:option(ListValue, "redirect", port..translate("Redirect"), translate("AdGuardHome redirect mode"))
o.placeholder = "none"
o:value("none", translate("none"))
o:value("dnsmasq-upstream", translate("Run as dnsmasq upstream server"))
o:value("redirect", translate("Redirect 53 port to AdGuardHome"))
o:value("exchange", translate("Use port 53 replace dnsmasq"))
o.default     = "none"
o.optional = true

o = s:option(DynamicList, "wan_ifname", translate("WAN Interface"))
o.datatype = "string"
o.description = translate("Only effective in redirect mode, bypass specified interfaces to avoid becoming a public DNS resolver")
local sys = require "luci.sys"
local util = require "luci.util"
local ifaces = sys.exec("ls -1 /sys/class/net/ 2>/dev/null")
if ifaces then
	for iface in ifaces:gmatch("%S+") do
		if iface ~= "lo" then
			o:value(iface, iface)
		end
	end
end

o = s:option(Value, "binpath", translate("Bin Path"), translate("AdGuardHome Bin path if no bin will auto download"))
o.default = "/usr/bin/AdGuardHome/AdGuardHome"
o.datatype = "string"
o.optional = false
o.rmempty=false
o.validate=function(self, value)
if value=="" then return nil end
if fs.stat(value,"type")=="dir" then
	fs.rmdir(value)
end
if fs.stat(value,"type")=="dir" then
	if (m.message) then
	m.message =m.message.."\nerror!bin path is a dir"
	else
	m.message ="error!bin path is a dir"
	end
	return nil
end
return value
end
o = s:option(Value, "configpath", translate("Config Path"), translate("AdGuardHome config path"))
o.default     = "/etc/AdGuardHome.yaml"
o.datatype    = "string"
o.optional = false
o.rmempty=false
o.validate=function(self, value)
if value==nil then return nil end
if fs.stat(value,"type")=="dir" then
	fs.rmdir(value)
end
if fs.stat(value,"type")=="dir" then
	if m.message then
	m.message =m.message.."\nerror!config path is a dir"
	else
	m.message ="error!config path is a dir"
	end
	return nil
end
return value
end
o = s:option(Value, "workdir", translate("Work dir"), translate("AdGuardHome work dir include rules,audit log and database"))
o.default = "/usr/bin/AdGuardHome"
o.datatype = "string"
o.optional = false
o.rmempty=false
o.validate=function(self, value)
if value=="" then return nil end
if fs.stat(value,"type")=="reg" then
	if m.message then
	m.message =m.message.."\nerror!work dir is a file"
	else
	m.message ="error!work dir is a file"
	end
	return nil
end
if string.sub(value, -1)=="/" then
	return string.sub(value, 1, -2)
else
	return value
end
end
o = s:option(Value, "logfile", translate("Runtime log file"), translate("AdGuardHome runtime Log file if 'syslog': write to system log;if empty no log"))
o.datatype    = "string"
o.rmempty = true
o.validate=function(self, value)
if fs.stat(value,"type")=="dir" then
	fs.rmdir(value)
end
if fs.stat(value,"type")=="dir" then
	if m.message then
	m.message =m.message.."\nerror!log file is a dir"
	else
	m.message ="error!log file is a dir"
	end
	return nil
end
return value
end
o = s:option(Flag, "verbose", translate("Verbose log"))
o.default = 0
o.optional = true
o = s:option(Value, "hashpass", translate("Change browser management password"), translate("Press load culculate model and culculate finally save/apply"))
o.default     = ""
o.datatype    = "string"
o.template = "AdGuardHome/AdGuardHome_chpass"
o.optional = true

function m.on_commit(map)
	if (fs.access("/var/run/AdGserverdis")) then
		io.popen("/etc/init.d/AdGuardHome reload &")
		return
	end
	local ucitracktest=uci:get("AdGuardHome","AdGuardHome","ucitracktest")
	if ucitracktest=="1" then
		return
	elseif ucitracktest=="0" then
		io.popen("/etc/init.d/AdGuardHome reload &")
	else
		if (fs.access("/var/run/AdGlucitest")) then
			uci:set("AdGuardHome","AdGuardHome","ucitracktest","0")
			io.popen("/etc/init.d/AdGuardHome reload &")
		else
			fs.writefile("/var/run/AdGlucitest","")
			if (ucitracktest=="2") then
				uci:set("AdGuardHome","AdGuardHome","ucitracktest","1")
			else
				uci:set("AdGuardHome","AdGuardHome","ucitracktest","2")
			end
		end
        uci:commit("AdGuardHome")
	end
end
return m