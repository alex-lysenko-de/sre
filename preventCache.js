
    (function() {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Проверка наличия getParameterTime
    const hasTime = params.has('getParameterTime');

    if (!hasTime) {
    // Добавляем getParameterTime (метка времени)
    const timestamp = Date.now().toString();
    params.set('getParameterTime', timestamp);

    // Формируем новый URL с сохранением всех параметров
    url.search = params.toString();

    // Редирект на саму себя с добавленным параметром
    window.location.replace(url.toString());
    return; // остановим выполнение дальше
}

    // Если getParameterTime уже есть — удаляем всё, кроме него
    const newUrl = new URL(window.location.href);
    const preservedTime = newUrl.searchParams.get('getParameterTime');

    // Очищаем все параметры
    newUrl.search = '';
    newUrl.searchParams.set('getParameterTime', preservedTime);

    // Перезаписываем адресную строку без перезагрузки страницы
    window.history.replaceState(null, '', newUrl.toString());

    // Здесь может идти основной код приложения
    console.log('Готово, можно запускать приложение без риска кэширования.');
})();
