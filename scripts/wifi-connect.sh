#!/bin/bash

# WiFi connection script using fuzzel and NetworkManager

# Rescan for networks
nmcli device wifi rescan 2>/dev/null

# Get list of available networks, remove duplicates, and format nicely
networks=$(nmcli -f SSID,SECURITY,SIGNAL device wifi list | \
    tail -n +2 | \
    awk '!seen[$0]++' | \
    sort -k3 -rn)

# If no networks found, notify and exit
if [ -z "$networks" ]; then
    notify-send "WiFi" "No networks found"
    exit 1
fi

# Show networks in fuzzel and get selection
selected=$(echo "$networks" | fuzzel --dmenu --prompt "Select WiFi: ")

# Exit if no selection made
if [ -z "$selected" ]; then
    exit 0
fi

# Extract SSID (everything before the security type or spaces at the end)
ssid=$(echo "$selected" | awk '{$NF=""; $(NF-1)=""; print $0}' | sed 's/[[:space:]]*$//')

# Check if network requires password
security=$(echo "$selected" | awk '{print $(NF-1)}')

if [ "$security" != "--" ]; then
    # Network is secured, prompt for password
    password=$(echo "" | fuzzel --dmenu --prompt "Password for $ssid: " --password)

    # Exit if no password provided
    if [ -z "$password" ]; then
        notify-send "WiFi" "Connection cancelled"
        exit 0
    fi

    # Connect with password
    if nmcli device wifi connect "$ssid" password "$password"; then
        notify-send "WiFi" "Connected to $ssid"
    else
        notify-send "WiFi" "Failed to connect to $ssid"
        exit 1
    fi
else
    # Network is open, connect without password
    if nmcli device wifi connect "$ssid"; then
        notify-send "WiFi" "Connected to $ssid"
    else
        notify-send "WiFi" "Failed to connect to $ssid"
        exit 1
    fi
fi
