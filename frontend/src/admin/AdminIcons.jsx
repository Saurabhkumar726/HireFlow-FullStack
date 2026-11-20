const glyphs = {
    ArrowRight: '→', Moon: '☾', Sun: '☀', BriefcaseBusiness: '▣', CheckCircle2: '✓', Eye: '◉', EyeOff: '⊘',
    LockKeyhole: '▣', ShieldCheck: '◆', Users: '♙', Zap: 'ϟ', Check: '✓',
    Clock3: '◷', LogOut: '↪', RefreshCw: '↻', Trash2: '×',
}

function makeIcon(name) {
    function Icon({ size = 18, className, ...props }) {
        return <span aria-hidden="true" className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, fontSize: size, lineHeight: 1, flexShrink: 0 }} {...props}>{glyphs[name]}</span>
    }
    Icon.displayName = name
    return Icon
}

export const ArrowRight = makeIcon('ArrowRight')
export const BriefcaseBusiness = makeIcon('BriefcaseBusiness')
export const CheckCircle2 = makeIcon('CheckCircle2')
export const Eye = makeIcon('Eye')
export const EyeOff = makeIcon('EyeOff')
export const LockKeyhole = makeIcon('LockKeyhole')
export const ShieldCheck = makeIcon('ShieldCheck')
export const Users = makeIcon('Users')
export const Zap = makeIcon('Zap')
export const Check = makeIcon('Check')
export const Clock3 = makeIcon('Clock3')
export const LogOut = makeIcon('LogOut')
export const RefreshCw = makeIcon('RefreshCw')
export const Trash2 = makeIcon('Trash2')

export const Moon = makeIcon('Moon')
export const Sun = makeIcon('Sun')
