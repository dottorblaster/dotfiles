local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

vim.g.mapleader = " "

require("lazy").setup({
  "yuezk/vim-js",
  "maxmellon/vim-jsx-pretty",
  "neovimhaskell/haskell-vim",
  "elixir-editors/vim-elixir",
  {"fatih/vim-go", cmd = "GoUpdateBinaries" },
  "reedes/vim-pencil",
  "junegunn/goyo.vim",
  "scrooloose/nerdtree",
  "jistr/vim-nerdtree-tabs",
  "junegunn/fzf.vim",
  "prabirshrestha/async.vim",
  "tpope/vim-surround",
  "williamboman/mason.nvim",
  "williamboman/mason-lspconfig.nvim",
  "neovim/nvim-lspconfig",
  "hrsh7th/nvim-cmp",
  "hrsh7th/cmp-nvim-lsp",
  "hrsh7th/cmp-buffer",
  "saadparwaiz1/cmp_luasnip",
  "L3MON4D3/LuaSnip",
  "nvim-lua/popup.nvim",
  "nvim-lua/plenary.nvim",
  "MunifTanjim/nui.nvim",
  "nvim-neo-tree/neo-tree.nvim",
  "nvim-telescope/telescope.nvim",
  {"nvim-treesitter/nvim-treesitter", cmd = "TSUpdate"},
  "RRethy/nvim-base16",
  "hoob3rt/lualine.nvim",
  "lewis6991/gitsigns.nvim",
  "Pocco81/true-zen.nvim",
  {"saecki/crates.nvim", tag = "v0.3.0" },
  "kyazdani42/nvim-web-devicons",
})

vim.opt.backup = false
vim.opt.wb = false
vim.opt.swapfile = false
vim.opt.autoread = true
vim.opt.hlsearch = true

vim.opt.ai = true
vim.opt.si = true
vim.opt.wrap = true
vim.opt.belloff = "all"
vim.opt.mouse = "a"

vim.opt.shiftwidth = 2
vim.opt.softtabstop = 2
vim.opt.expandtab = true
vim.opt.smarttab = true
vim.opt.backspace = "2"
vim.opt.nu = true

vim.opt.splitright = true

vim.opt.termguicolors = true

vim.cmd('let base16colorspace=256')

vim.api.nvim_create_user_command(
  'CopyFilePath',
  function(_)
    vim.cmd("let @+=expand('%')")
  end,
  { nargs = 0 }
)

vim.api.nvim_create_user_command(
    'Blog',
    function(_)
      vim.cmd('Neotree close')
      require('lualine').hide()
      vim.cmd('TZAtaraxis')
      vim.cmd('SoftPencil')
    end,
    { nargs = 0 }
)

vim.api.nvim_create_user_command(
  'FrontMatter',
  function(_)
    vim.cmd('')
  end,
  { nargs = 0 }
)

vim.cmd [[ colorscheme base16-tomorrow-night ]]

vim.api.nvim_set_hl(0, 'VertSplit', {
  bg = "NONE",
  fg = "#373b41",
  ctermbg = 6,
  ctermfg = 0,
})

local actions = require('telescope.actions')
local action_set = require "telescope.actions.set"

function my_select(bufnr)
  vim.api.nvim_input("<esc>")
  vim.wait(1000, function()
    return action_set.select(bufnr, "default")
  end)
end

-- luasnip setup
local luasnip = require 'luasnip'

-- nvim-cmp setup
local cmp = require 'cmp'
cmp.setup {
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end,
  },
  mapping = cmp.mapping.preset.insert({
    ['<C-d>'] = cmp.mapping.scroll_docs(-4),
    ['<C-f>'] = cmp.mapping.scroll_docs(4),
    ['<C-Space>'] = cmp.mapping.complete(),
    ['<CR>'] = cmp.mapping.confirm {
      behavior = cmp.ConfirmBehavior.Replace,
      select = true,
    },
    ['<Tab>'] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_next_item()
      elseif luasnip.expand_or_jumpable() then
        luasnip.expand_or_jump()
      else
        fallback()
      end
    end, { 'i', 's' }),
    ['<S-Tab>'] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_prev_item()
      elseif luasnip.jumpable(-1) then
        luasnip.jump(-1)
      else
        fallback()
      end
    end, { 'i', 's' }),
  }),
  sources = {
    { name = 'nvim_lsp' },
    { name = 'luasnip' },
    { name = 'buffer' }
  },
}

require("mason").setup()
require("mason-lspconfig").setup({
  ensure_installed = {"rust_analyzer", "elixirls", "tsserver"}
})

local on_attach = function(client, bufnr)
  -- Enable completion triggered by <c-x><c-o>
  vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.vim.lsp.omnifunc')

  -- Mappings.
  -- See `:help vim.lsp.*` for documentation on any of the below functions
  local bufopts = { noremap=true, silent=true, buffer=bufnr }
  vim.keymap.set('n', 'gD', vim.lsp.buf.declaration, bufopts)
  vim.keymap.set('n', 'gd', vim.lsp.buf.definition, bufopts)
  vim.keymap.set('n', 'K', vim.lsp.buf.hover, bufopts)
  vim.keymap.set('n', 'gi', vim.lsp.buf.implementation, bufopts)
  vim.keymap.set('n', '<C-k>', vim.lsp.buf.signature_help, bufopts)
  vim.keymap.set('n', '<space>wa', vim.lsp.buf.add_workspace_folder, bufopts)
  vim.keymap.set('n', '<space>wr', vim.lsp.buf.remove_workspace_folder, bufopts)
  vim.keymap.set('n', '<space>wl', function()
    print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
  end, bufopts)
  vim.keymap.set('n', '<space>D', vim.lsp.buf.type_definition, bufopts)
  vim.keymap.set('n', '<space>rn', vim.lsp.buf.rename, bufopts)
  vim.keymap.set('n', '<space>ca', vim.lsp.buf.code_action, bufopts)
  vim.keymap.set('n', 'gr', vim.lsp.buf.references, bufopts)
  vim.keymap.set('n', '<space>f', function() vim.lsp.buf.format { async = true } end, bufopts)
end

local lsp_flags = {
  -- This is the default in Nvim 0.7+
  debounce_text_changes = 300,
}

require('lspconfig')['tsserver'].setup{
    on_attach = on_attach,
    flags = lsp_flags
}
require('lspconfig')['elixirls'].setup{
    on_attach = on_attach,
    flags = lsp_flags
}
require('lspconfig')['rust_analyzer'].setup{
    on_attach = on_attach,
    flags = lsp_flags
}

require('telescope').setup{
  defaults = {
    vimgrep_arguments = {
      'rg',
      '--hidden',
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
    find_files = {
      hidden = true,
    },
    live_grep = {
      mappings = {
        i = {
        }
      }
    }
  }
}

local builtin = require('telescope.builtin')
vim.keymap.set('n', '<C-p>', builtin.find_files, {})
vim.keymap.set('n', '<C-f>', builtin.live_grep, {})
-- vim.keymap.set('n', '<leader>fb', builtin.buffers, {})
-- vim.keymap.set('n', '<leader>fh', builtin.help_tags, {})

require'nvim-treesitter.configs'.setup {
  ensure_installed = "all", -- one of "all", "maintained" (parsers with maintainers), or a list of languages
  highlight = {
    enable = true,              -- false will disable the whole extension
    disable = { "c", "elixir" },  -- list of language that will be disabled
    -- Setting this to true will run `:h syntax` and tree-sitter at the same time.
    -- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
    -- Using this option may slow down your editor, and you may see some duplicate highlights.
    -- Instead of true it can also be a list of languages
    additional_vim_regex_highlighting = false,
  },
}

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

require('gitsigns').setup({
  signcolumn = false,
})

require("true-zen").setup {
  inetgrations = {
    lualine = true,
  },
  modes = {
    ataraxis = {
      padding = { -- padding windows
        left = 52,
        right = 52,
        top = 10,
        bottom = 10,
      },
    },
  },
}

require('crates').setup()

require("neo-tree").setup({
  close_if_last_window = true,
  window = {
    width = 30,
  },
})

vim.api.nvim_create_autocmd("VimEnter", {
  command = "Neotree toggle",
})

