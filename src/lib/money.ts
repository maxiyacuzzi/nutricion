const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export const formatMoney = (amount: number) => fmt.format(amount)
