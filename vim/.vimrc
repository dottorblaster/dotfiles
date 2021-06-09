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

Plug 'chriskempson/base16-vim'

Plug 'yuezk/vim-js'
Plug 'maxmellon/vim-jsx-pretty'
Plug 'neovimhaskell/haskell-vim'
Plug 'elixir-editors/vim-elixir'
Plug 'reasonml-editor/vim-reason-plus'
Plug 'rust-lang/rust.vim'
Plug 'fatih/vim-go', { 'do': ':GoUpdateBinaries' }
Plug 'evanleck/vim-svelte', {'branch': 'main'}

Plug 'Shougo/deoplete.nvim'
Plug 'roxma/nvim-yarp'
Plug 'roxma/vim-hug-neovim-rpc'

Plug 'reedes/vim-pencil'
Plug 'junegunn/goyo.vim'

Plug 'scrooloose/nerdtree'
Plug 'jistr/vim-nerdtree-tabs'

Plug '/usr/local/opt/fzf'
Plug 'junegunn/fzf.vim'

Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'

Plug 'prabirshrestha/async.vim'
Plug 'tpope/vim-surround'

Plug 'prabirshrestha/vim-lsp'
Plug 'mattn/vim-lsp-settings'
Plug 'lighttiger2505/deoplete-vim-lsp'

Plug 'franbach/miramare'
call plug#end()

" Access colors present in 256 colorspace
let base16colorspace=256

" Colorscheme. I'll set base16-tomorrow
" You need to install it first.
" Here the link: https://github.com/chriskempson/base16-vim
colorscheme base16-tomorrow-night

" Airline theme config
let g:airline_theme='wombat'

" NERDTree stuff
map <C-n> :NERDTreeTabsToggle<CR>
let NERDTreeShowHidden=1
let g:nerdtree_tabs_open_on_console_startup=1
let g:nerdtree_tabs_focus_on_files=1

" FZF mapping
map <C-p> :FZF<CR>
map <C-f> :Rg<CR>

let g:deoplete#enable_at_startup = 1
call deoplete#custom#option({
  \ 'auto_complete_delay': 200,
  \ 'smart_case': v:true,
  \ })

:command CopyFilePath :let @+=expand('%')

function BlogCommands()
  :Goyo
  :NERDTreeClose
  :SoftPencil
endfunction

:command Blog :call BlogCommands()

