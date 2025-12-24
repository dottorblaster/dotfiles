#!/bin/bash

# Get list of windows from Sway
# Extract only visible windows (not scratchpad, not hidden)
windows=$(swaymsg -t get_tree | jq -r '
  .. |
  select(.type? == "con" and .pid? != null and (.name? // "") != "") |
  "\(.id)|\(.app_id // .window_properties.class // "unknown")|\(.name)"
')

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

# Extract the line number to get the corresponding window ID
line_num=$(echo "$selected" | grep -oE '^[0-9]+')
window_id=$(echo "$windows" | sed -n "${line_num}p" | cut -d'|' -f1)

# Focus the selected window
if swaymsg "[con_id=${window_id}] focus" >/dev/null 2>&1; then
    window_title=$(echo "$windows" | sed -n "${line_num}p" | cut -d'|' -f3)
    notify-send "Window Switcher" "Switched to: $window_title"
else
    notify-send "Window Switcher" "Failed to switch window"
    exit 1
fi
