try {
        var savedTheme = localStorage.getItem('15month_theme');
        var isDark = savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
        document.documentElement.classList.toggle('miku', savedTheme === 'miku');
        document.documentElement.classList.toggle('alya', savedTheme === 'alya');
        document.documentElement.classList.toggle('marciana', savedTheme === 'marciana');
        document.documentElement.classList.toggle('elaina', savedTheme === 'elaina');
      } catch {}
