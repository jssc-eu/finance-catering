const { promisify }  = require('util')
const fs = require('fs')
const argv = require('minimist')(process.argv.slice(2))
const csv = require('csv')

const COMBO_CATERING = 147
const CSS_CATERING = 55
const JS_CATERING = 92

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

const comboPairs = [
	[ /^early combo/, /^early bird/ ],
	[ /^combo/, /^regular/ ],
	[ /^epam/, /^sponsor/ ],
	[ /^oracle/, /^sponsor/ ],
	[ /^mozilla/, /^sponsor/ ],
	[ /^blackrock/, /^sponsor/ ],
	[ /^supercharge/, /^sponsor/ ],
	[ /^booth/, /^jsconf bp promotional/ ],
	[ /^ibm/, /^regular/ ],
]

const itemizeTickets = (item) => {
	const items = item.match(/^(\d*) x (.*)/)
	items.shift()
	items[0] = parseInt(items[0], 10)
	return Array.from(items)
}

const handleCombos = (tickets) => {
	let result = tickets.slice(0)

	result.forEach(([amount, name], index) => {
		comboPairs.forEach(pair => {
			if (pair[0].test(name.toLowerCase())) {
				const comboTicketIndex = result.findIndex(([a, ticket]) => pair[0].test(ticket.toLowerCase()))
				const attachedTicketIndex = result.findIndex(([a, ticket]) => pair[1].test(ticket.toLowerCase()))

				console.log(
					result[comboTicketIndex][0],
					result[attachedTicketIndex][0]
				);

				result[attachedTicketIndex][0] = result[attachedTicketIndex][0] - result[comboTicketIndex][0]
			}
		})
	})

	// cleanup zero amount tickets
	result = result.filter((item) => {
		return item[0] > 0
	})

	return result
}

const hasCombo = (tickets) => {
	return tickets.reduce((bool, items) => {
		if (bool) return bool

		return (
			items[1].toLowerCase().indexOf('combo') > -1
			|| items[1].toLowerCase().indexOf('epam') > -1
			|| items[1].toLowerCase().indexOf('supercharge') > -1
			|| items[1].toLowerCase().indexOf('blackrock') > -1
			|| items[1].toLowerCase().indexOf('mozilla') > -1
			|| items[1].toLowerCase().indexOf('booth') > -1
			|| items[1].toLowerCase().indexOf('oracle') > -1
		)
	}, false)
}

const handleCatering = (tickets) => {
	const catering = tickets.map((ticket) => {
		if (
			/combo/.test(ticket[1].toLowerCase())
			|| /epam/.test(ticket[1].toLowerCase())
			|| /blackrock/.test(ticket[1].toLowerCase())
			|| /mozilla/.test(ticket[1].toLowerCase())
			|| /supercharge/.test(ticket[1].toLowerCase())
			|| /oracle/.test(ticket[1].toLowerCase())
		) {
			return COMBO_CATERING
		}


		if (/css/.test(ticket[1].toLowerCase())) {
			return CSS_CATERING
		}
		return JS_CATERING
	})
	return catering.join('\n')
}

const parse = async function (data) {

	return new Promise((resolve, reject) => {
		csv.parse(data, {columns: true}, (err, csvData) => {

			if (err) return reject(err)

			const data = csvData.map((data) => {
				const order = Object.assign({}, data)
				let tickets = order.Tickets.trim().split('\n').map(itemizeTickets)

				// ha van combo, akkor annak megfelelo included ticket vonodjon le
				if (hasCombo(tickets)) {
					tickets = handleCombos(tickets)
				}

				const catering = handleCatering(tickets)

				order.Tickets = tickets.map(t => t.join(' x ')).join('\n')

				const result = Object.entries(order).reduce((obj, [key, value]) => {
					if (key === 'Tickets') {
						obj['Catering items (EUR)'] = catering
					}
					obj[key] = value

					return obj
				}, {})

				return result
			})

			csv.stringify(
				data,
				{
					header: true
				},
				(err, result) => {
					if (err) return reject(err);

					resolve(result)
				}
			)
		})
	})
}


const start = async function (fileName) {

	const file = (await readFile(fileName)).toString()

	const result = await parse(file)

	//console.log(result);

	await writeFile(`${fileName.replace('.csv', '')}_processed.csv`, result)

}

start(argv._[0])