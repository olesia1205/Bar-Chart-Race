import * as d3 from "d3";

async function init() {
  try {
    const data = await getDataFromCsv('dataset.csv');
    render(data);
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
  }
}

function getDataFromCsv(url) {
  return d3.text(url).then(text => {
    // Заменяем все запятые на точки для корректного парсинга дробных чисел
    const fixedText = text.replace(/,/g, '.');

    // Используем d3.dsvFormat для указания разделителя ';'
    const parser = d3.dsvFormat(';');

    // Парсим текст с использованием кастомного парсера
    return parser.parse(fixedText, d => {
      // Преобразуем строковые значения в числа, кроме поля 'Country'
      for (let key in d) {
        if (key !== 'Country') {
          d[key] = +d[key];
        }
      }
      return d;
    });
  });
}

function render(data) {
  // Удаляем предыдущий SVG, если он существует
  d3.select('#app').selectAll('svg').remove();

  const svgElement = d3.select('#app')
                      .append('svg')
                      .attr('width', '100%')
                      .attr('height', '100%')
                      .attr('viewBox', `0 0 1000 560`)
                      .attr('preserveAspectRatio', 'xMidYMid meet');

  const width = 1000; // Исходная ширина для расчета
  const height = 600; // Исходная высота для расчета
  const interval = 2000; // Интервал обновления в миллисекундах
  const topN = 18;

  const margin = { left: 200, right: 60, top: 40, bottom: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const colorScale = d3.scaleOrdinal(d3.schemePaired);

  // Извлекаем список интервалов из ключей первого объекта данных
  const intervals = Object.keys(data[0]).filter(key => key !== 'Country');

  // Сортируем интервалы на основе начального года
  intervals.sort((a, b) => {
    const startA = parseInt(a.split('-')[0], 10);
    const startB = parseInt(b.split('-')[0], 10);
    return startA - startB;
  });

  // Устанавливаем домен для цветовой шкалы
  colorScale.domain(data.map(d => d['Country']));

  const g = svgElement.append('g')
                     .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // Создаем группу для оси X
  const topAxis = g.append('g')
                   .attr('class', 'x-axis')
                   .attr('transform', `translate(0, 0)`);

  // Добавляем метку интервала
  const intervalLabel = g.append('text')
                         .attr('x', innerWidth - 100)
                         .attr('y', -20)
                         .attr('class', 'intervalLabel')
                         .attr('font-size', '22px')
                         .attr('font-weight', 'bold')
                         .text(intervals[0]);

  // Инициализируем индекс текущего интервала
  let intervalIndex = 0;
  const endIndex = intervals.length;

  // Инициализируем шкалы
  const xScale = d3.scaleLinear()
                   .range([0, innerWidth]);

  const yScale = d3.scaleBand()
                   .range([0, innerHeight])
                   .padding(0.2);

  // Инициализируем ось X
  const xAxis = d3.axisTop(xScale).ticks(5).tickSize(-innerHeight);
  topAxis.call(xAxis)
         .selectAll('line')
         .attr('stroke', '#ddd')
         .attr('y1', 0)
         .attr('y2', 0);

  // Функция для обновления графика
  function update(currentInterval) {
    // Фильтруем и сортируем данные для текущего интервала
    const tickData = data
      .map(d => ({ Country: d['Country'], value: d[currentInterval] }))
      .sort((a, b) => d3.descending(a.value, b.value))
      .slice(0, 18); // topN = 16

    // Обновляем шкалы
    xScale.domain([0, d3.max(tickData, d => d.value)]);
    yScale.domain(tickData.map(d => d.Country));

    // Обновляем ось X с анимацией
    topAxis.transition()
           .duration(interval - 500) // Интервал обновления
           .call(xAxis)
           .selectAll('line')
           .attr('y2', innerHeight);

    // Привязываем данные к элементам
    const bars = g.selectAll('.bar')
                  .data(tickData, d => d.Country);

    // Удаляем отсутствующие элементы
    bars.exit()
        .transition()
        .duration(interval - 500)
        .attr('opacity', 0)
        .remove();

    // Обновляем существующие элементы
    bars.transition()
        .duration(interval - 500)
        .attr('transform', d => `translate(0, ${yScale(d.Country)})`);

    bars.select('rect')
        .transition()
        .duration(interval - 500)
        .attr('width', d => xScale(d.value));

    bars.select('.num')
        .transition()
        .duration(interval - 500)
        .attr('x', d => xScale(d.value) + 5)
        .tween('text', function(d) {
          const node = d3.select(this);
          const currentValue = parseFloat(node.text().replace(/,/g, '')) || 0;
          const interpolator = d3.interpolateNumber(currentValue, d.value);
          return function(t) {
            node.text(d3.format(",.1f")(interpolator(t)));
          };
        });

    // Обновляем метку интервала
    intervalLabel.text(currentInterval);

    // Добавляем новые элементы
    const barsEnter = bars.enter()
                          .append('g')
                          .attr('class', 'bar')
                          .attr('transform', d => `translate(0, ${yScale(d.Country)})`)
                          .attr('opacity', 0);

    barsEnter.transition()
             .duration(interval - 500)
             .attr('opacity', 1);

    barsEnter.append('rect')
             .attr('height', yScale.bandwidth())
             .attr('width', 0)
             .attr('fill', d => colorScale(d.Country))
             .transition()
             .duration(interval - 500)
             .attr('width', d => xScale(d.value));

    barsEnter.append('text')
             .attr('class', 'num')
             .attr('y', yScale.bandwidth() / 2)
             .attr('x', d => xScale(d.value) + 5)
             .attr('dy', '.35em')             
             .text('0')
             .transition()
             .duration(interval - 500)
             .tween('text', function(d) {
               const node = d3.select(this);
               const interpolator = d3.interpolateNumber(0, d.value);
               return function(t) {
                 node.text(d3.format(",.1f")(interpolator(t)));
               };
             });

    barsEnter.append('text')
             .attr('class', 'label')
             .attr('y', yScale.bandwidth() / 2)
             .attr('x', -10)
             .attr('dy', '.35em')
             .attr('text-anchor', 'end')
             .text(d => d.Country);
  }

  // Запускаем интервал обновления
  const timer = d3.interval(() => {
    if (intervalIndex >= endIndex) {
      timer.stop();
      return;
    }

    const currentInterval = intervals[intervalIndex];
    update(currentInterval);

    intervalIndex++;
  }, interval); // Интервал обновления 2 секунды

  // Инициализируем первый кадр
  update(intervals[intervalIndex]);
  intervalIndex++;
}

init();
