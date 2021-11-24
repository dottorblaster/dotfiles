" Switch syntax highlighting on, when the terminal has colors
" Also switch on highlighting the last used search pattern.
if &t_Co > 2 || has("gui_running")
  syntax on
  set hlsearch
endif

" Turn backup off, since most stuff is in SVN, git et.c anyway...
set nobackup
set nowb
set noswapfile
set autoread

" Auto-indent, smart indent and wrap lines
set ai
set si
set wrap
set belloff=all
set mouse=a
set nu

" Indentation settings for using 2 spaces instead of tabs
" Other stuff like smarttab
set shiftwidth=2
set softtabstop=2
set expandtab
set smarttab
set backspace=2

set splitright

" Set termguicolors for shit
set termguicolors

" Plug section
call plug#begin('~/.vim/plugged')
Plug 'yuezk/vim-js'
Plug 'maxmellon/vim-jsx-pretty'
Plug 'neovimhaskell/haskell-vim'
Plug 'elixir-editors/vim-elixir'
Plug 'reasonml-editor/vim-reason-plus'
Plug 'rust-lang/rust.vim'
Plug 'fatih/vim-go', { 'do': ':GoUpdateBinaries' }
"Plug 'evanleck/vim-svelte', {'branch': 'main'}

"Plug 'Shougo/deoplete.nvim'
"Plug 'roxma/nvim-yarp'
"Plug 'roxma/vim-hug-neovim-rpc'

Plug 'reedes/vim-pencil'
Plug 'junegunn/goyo.vim'

Plug 'scrooloose/nerdtree'
Plug 'jistr/vim-nerdtree-tabs'

Plug '/usr/local/opt/fzf'
Plug 'junegunn/fzf.vim'

Plug 'prabirshrestha/async.vim'
Plug 'tpope/vim-surround'

"Plug 'prabirshrestha/vim-lsp'
"Plug 'mattn/vim-lsp-settings'
"Plug 'lighttiger2505/deoplete-vim-lsp'

Plug 'neoclide/coc.nvim', {'branch': 'release'}

Plug 'nvim-lua/popup.nvim'
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'
Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'}
Plug 'RRethy/nvim-base16'
Plug 'hoob3rt/lualine.nvim'
Plug 'lewis6991/gitsigns.nvim'
"Plug 'kyazdani42/nvim-web-devicons'
call plug#end()

" Access colors present in 256 colorspace
let base16colorspace=256

" Colorscheme. I'll set base16-tomorrow
" You need to install it first.
" Here the link: https://github.com/chriskempson/base16-vim
colorscheme base16-tomorrow-night

" NERDTree stuff
map <C-n> :NERDTreeTabsToggle<CR>
let NERDTreeShowHidden=1
let g:nerdtree_tabs_open_on_console_startup=1
let g:nerdtree_tabs_focus_on_files=1

" FZF mapping
map <C-p> :FZF<CR>
map <C-f> :Rg<CR>

"let g:deoplete#enable_at_startup = 1
"call deoplete#custom#option({
"  \ 'auto_complete_delay': 200,
"  \ 'smart_case': v:true,
"  \ })

:command CopyFilePath :let @+=expand('%')

function BlogCommands()
  :Goyo
  :NERDTreeClose
  :SoftPencil
  :lua require('lualine').setup { options = { disabled_filetypes = { 'lua' } } }
endfunction

function FrontMatterCommand()
  :read !bundle exec thor fm | sed $'s,\x1b\\[[0-9;]*[a-zA-Z],,g'
endfunction

:command Blog :call BlogCommands()
:command FrontMatter :call FrontMatterCommand()

"set fillchars=vert:\ 
highlight VertSplit guibg=NONE guifg=#373b41 ctermbg=6 ctermfg=0

lua << EOF
local actions = require('telescope.actions')
local action_set = require "telescope.actions.set"

function my_select(bufnr)
  vim.api.nvim_input("<esc>")
  vim.wait(1000, function()
    return action_set.select(bufnr, "default")
  end)
end

require('telescope').setup{
  defaults = {
    vimgrep_arguments = {
      'rg',
      '--color=never',
      '--no-heading',
      '--with-filename',
      '--line-number',
      '--column',
      '--smart-case'
    },
    prompt_prefix = "> ",
    selection_caret = "> ",
    entry_prefix = "  ",
    initial_mode = "insert",
    selection_strategy = "reset",
    sorting_strategy = "descending",
    layout_strategy = "horizontal",
    layout_config = {
      horizontal = {
        mirror = false,
      },
      vertical = {
        mirror = false,
      },
    },
    file_sorter =  require'telescope.sorters'.get_fuzzy_file,
    file_ignore_patterns = {},
    generic_sorter =  require'telescope.sorters'.get_generic_fuzzy_sorter,
    winblend = 0,
    border = {},
    borderchars = { '─', '│', '─', '│', '╭', '╮', '╯', '╰' },
    color_devicons = true,
    use_less = true,
    path_display = {},
    set_env = { ['COLORTERM'] = 'truecolor' }, -- default = nil,
    file_previewer = require'telescope.previewers'.vim_buffer_cat.new,
    grep_previewer = require'telescope.previewers'.vim_buffer_vimgrep.new,
    qflist_previewer = require'telescope.previewers'.vim_buffer_qflist.new,

    -- Developer configurations: Not meant for general override
    buffer_previewer_maker = require'telescope.previewers'.buffer_previewer_maker
  },
  pickers = {
    live_grep = {
      mappings = {
        i = {
        }
      }
    }
  }
}
EOF

lua << EOF
require'nvim-treesitter.configs'.setup {
  ensure_installed = "maintained", -- one of "all", "maintained" (parsers with maintainers), or a list of languages
  highlight = {
    enable = true,              -- false will disable the whole extension
    disable = { "c" },  -- list of language that will be disabled
    -- Setting this to true will run `:h syntax` and tree-sitter at the same time.
    -- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
    -- Using this option may slow down your editor, and you may see some duplicate highlights.
    -- Instead of true it can also be a list of languages
    additional_vim_regex_highlighting = false,
  },
}
EOF

lua << EOF
local base16_tomorrow_dark = require'lualine.themes.horizon'
local solid_bg = '#282828'
local light_solid_bg = '#383838'
local white = '#B6B6B6'
local red = '#AB4642'
local blue = '#81A2BE'
local yellow = '#F0C674'
local green = '#B5BD68'
local violet = '#B294BB'
local orange = '#DC9656'

base16_tomorrow_dark.inactive.a.fg = white
base16_tomorrow_dark.inactive.b.fg = white
base16_tomorrow_dark.inactive.b.bg = solid_bg
base16_tomorrow_dark.inactive.c.fg = white
base16_tomorrow_dark.normal.a.bg = green
base16_tomorrow_dark.insert.a.bg = yellow
base16_tomorrow_dark.replace.a.bg = orange
base16_tomorrow_dark.command.a.bg = blue
base16_tomorrow_dark.visual.a.bg = violet

base16_tomorrow_dark.inactive.b.bg = light_solid_bg
base16_tomorrow_dark.normal.b.bg = light_solid_bg
base16_tomorrow_dark.insert.b.bg = light_solid_bg
base16_tomorrow_dark.replace.b.bg = light_solid_bg
base16_tomorrow_dark.command.b.bg = light_solid_bg
base16_tomorrow_dark.visual.b.bg = light_solid_bg


base16_tomorrow_dark.inactive.b.fg = white
base16_tomorrow_dark.normal.b.fg = white
base16_tomorrow_dark.insert.b.fg = white
base16_tomorrow_dark.replace.b.fg = white
base16_tomorrow_dark.command.b.fg = white
base16_tomorrow_dark.visual.b.fg = white

base16_tomorrow_dark.normal.c.fg = white
base16_tomorrow_dark.insert.c.fg = white
base16_tomorrow_dark.command.c.fg = white
base16_tomorrow_dark.visual.c.fg = white
base16_tomorrow_dark.replace.c.fg = white

base16_tomorrow_dark.inactive.c.bg = solid_bg
base16_tomorrow_dark.normal.c.bg = solid_bg
base16_tomorrow_dark.insert.c.bg = solid_bg
base16_tomorrow_dark.replace.c.bg = solid_bg
base16_tomorrow_dark.command.c.bg = solid_bg
base16_tomorrow_dark.visual.c.bg = solid_bg

require'lualine'.setup{
  options = { theme  = base16_tomorrow_dark },
}
EOF

lua << EOF
require('gitsigns').setup({
  signcolumn = false,
})
EOF
