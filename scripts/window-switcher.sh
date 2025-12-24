#!/bin/bash

# Get list of windows from Hyprland
windows=$(hyprctl clients -j | jq -r '.[] | "\(.address)|\(.class)|\(.title)"')

if [ -z "$windows" ]; then
    notify-send "Window Switcher" "No windows found"
    exit 1
fi

# Format for fuzzel: show class and title
formatted_windows=$(echo "$windows" | awk -F'|' '{printf "%s: %s (%s)\n", NR, $2, $3}')

# Show fuzzel menu
selected=$(echo "$formatted_windows" | fuzzel --dmenu --prompt "Switch to window: ")

if [ -z "$selected" ]; then
    exit 0
fi

# Extract the line number to get the corresponding window address
line_num=$(echo "$selected" | grep -oE '^[0-9]+')
window_address=$(echo "$windows" | sed -n "${line_num}p" | cut -d'|' -f1)

# Focus the selected window
if hyprctl dispatch focuswindow "address:${window_address}" >/dev/null 2>&1; then
    window_title=$(echo "$windows" | sed -n "${line_num}p" | cut -d'|' -f3)
    notify-send "Window Switcher" "Switched to: $window_title"
else
    notify-send "Window Switcher" "Failed to switch window"
    exit 1
fi
