<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>@yield('title', 'HardhatLedger')</title>
    <style>
        /* ── Page Setup ── */
        @page { margin: 68px 30px 52px 30px; }

        /*
         * WARNING: Do NOT add a universal reset (* { margin:0; padding:0; })
         * or a broad element-list reset here. DomPDF treats element-level
         * margin/padding resets as overrides of @page margins, which
         * completely breaks position:fixed header/footer rendering.
         */
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 9pt;
            color: #2d3748;
            background: #ffffff;
            margin: 0; padding: 0;
            line-height: 1.4;
        }

        /* ══════════════════════════════════════════════════════════
           UNIFIED PAGE HEADER — repeats on every page via DomPDF
           Based on proven pattern from exports/expenses.blade.php:
             - NO overflow:hidden on fixed elements
             - NO nested position:absolute inside fixed
             - Amber accent bar is a SEPARATE fixed element
        ══════════════════════════════════════════════════════════ */
        .hhl-header {
            position: fixed;
            top: -58px;
            left: -30px;
            right: -30px;
            height: 54px;
            background: #1B3A5C;
            padding: 0 30px;
        }
        .hhl-header table { width: 100%; height: 54px; border-collapse: collapse; border-spacing: 0; }
        .hhl-header tr { background: transparent !important; }
        .hhl-header td { vertical-align: middle; padding: 0 !important; margin: 0; color: #fff; background: transparent !important; }

        .hhl-brand { font-size: 13pt; font-weight: bold; letter-spacing: 0.3px; }
        .hhl-brand-accent { color: #F5A623; }
        .hhl-tagline { font-size: 6.5pt; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 0.5px; }

        .hhl-doc-cell { text-align: right; }
        .hhl-doc-title { font-size: 10pt; font-weight: bold; }
        .hhl-doc-meta { font-size: 7pt; color: rgba(255,255,255,0.6); }

        /* Amber accent bar — separate fixed element, NOT nested inside .hhl-header */
        .hhl-accent {
            position: fixed;
            top: -4px;
            left: -30px;
            right: -30px;
            height: 4px;
            background: #F5A623;
        }

        /* ══════════════════════════════════════════════════════════
           UNIFIED PAGE FOOTER — repeats on every page
        ══════════════════════════════════════════════════════════ */
        .hhl-footer {
            position: fixed;
            bottom: -42px;
            left: -30px;
            right: -30px;
            height: 38px;
            border-top: 2px solid #F5A623;
            padding: 0 30px;
            background: #ffffff;
        }
        .hhl-footer table { width: 100%; height: 38px; border-collapse: collapse; border-spacing: 0; }
        .hhl-footer tr { background: transparent !important; }
        .hhl-footer td { vertical-align: middle; font-size: 7pt; color: #a0aec0; padding: 0 !important; margin: 0; background: transparent !important; }
        .hhl-footer-right { text-align: right; }

        /* ── Child template styles injected here (INSIDE the same <style> block) ── */
        @yield('extra-css')
    </style>
    @yield('extra-styles')
</head>
<body>

{{-- ── Fixed Header (repeats on every printed page) ── --}}
<div class="hhl-header">
    <table><tr>
        <td>
            <span class="hhl-brand">Hardhat<span class="hhl-brand-accent">Ledger</span></span><br>
            <span class="hhl-tagline">Construction Materials Supplier</span>
        </td>
        <td class="hhl-doc-cell">
            <span class="hhl-doc-title">@yield('doc-title')</span><br>
            <span class="hhl-doc-meta">@yield('doc-meta')</span>
        </td>
    </tr></table>
</div>
<div class="hhl-accent"></div>

{{-- ── Fixed Footer (repeats on every printed page) ── --}}
<div class="hhl-footer">
    <table><tr>
        <td>HardhatLedger 2026 &mdash; All rights reserved for CW Devs</td>
        <td class="hhl-footer-right">
            {{ now()->setTimezone('Asia/Manila')->format('M d, Y g:i A') }} PST
            <script type="text/php">
                if (isset($pdf)) {
                    $w = $pdf->get_width();
                    $h = $pdf->get_height();
                    $pdf->page_text($w - 95, $h - 26, "Page {PAGE_NUM} of {PAGE_COUNT}", null, 7, [160, 174, 192]);
                }
            </script>
        </td>
    </tr></table>
</div>

{{-- ── Page Content ── --}}
@yield('content')

</body>
</html>
