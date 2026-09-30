try {
        var savedTheme = localStorage.getItem('15month_theme');
        var savedTransparency = localStorage.getItem('15month_transparency');
        var transparency = savedTransparency !== null && savedTransparency.trim() !== '' && Number.isFinite(Number(savedTransparency)) ? Math.min(100, Math.max(0, Math.round(Number(savedTransparency)))) : 40;
        document.documentElement.style.setProperty('--panel-alpha', String(1 - transparency / 100));
        var isDark = savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
        document.documentElement.classList.toggle('miku', savedTheme === 'miku');
        document.documentElement.classList.toggle('alya', savedTheme === 'alya');
        document.documentElement.classList.toggle('marciana', savedTheme === 'marciana');
        document.documentElement.classList.toggle('elaina', savedTheme === 'elaina');
        document.documentElement.classList.toggle('yuno', savedTheme === 'yuno');
        document.documentElement.classList.toggle('emilia', savedTheme === 'emilia');
      } catch {}
