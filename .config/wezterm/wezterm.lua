local wezterm = require 'wezterm';
return {
  font = wezterm.font("Fira Code Nerd Font Mono", { weight="DemiBold" }),
  font_size = 8.0,
  window_padding = {
    left = 5,
    right = 5,
    top = 5,
    bottom = 5,
  },
  colors = {
    tab_bar = {
      background = '#1d1f21',
    },
    foreground = "#deddda",
    background = "#1d1f21",
    compose_cursor = "#deddda",
    cursor_bg = "#deddda",
    cursor_fg = "#1d1f21",
    cursor_border = "#1d1f21",
    ansi = {"#1d1f21", "#cc6666", "#b5bd68", "#f0c674", "#81a2be", "#b294bb", "#8abeb7", "#c5c8c6"},
    brights = {"#3d3846", "#cc6666", "#b5bd68", "#f0c674", "#81a2be", "#b294bb", "#8abeb7", "#ffffff"},
  },
  exit_behavior = "Close",
  hide_tab_bar_if_only_one_tab = true,
  use_fancy_tab_bar = false,
}
