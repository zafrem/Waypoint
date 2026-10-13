// Waypoint Web UI JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Auto-dismiss alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(function(alert) {
    setTimeout(function() {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.3s';
      setTimeout(function() {
        alert.remove();
      }, 300);
    }, 5000);
  });

  // Form confirmation for delete actions
  const deleteForms = document.querySelectorAll('form[action*="delete"]');
  deleteForms.forEach(function(form) {
    form.addEventListener('submit', function(e) {
      if (!confirm('Are you sure you want to delete this item?')) {
        e.preventDefault();
      }
    });
  });

  // Theme switcher
  const themeSelect = document.getElementById('theme');
  if (themeSelect) {
    themeSelect.addEventListener('change', function() {
      document.documentElement.setAttribute('data-theme', this.value);
    });
  }

  // Highlight current nav item
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(function(link) {
    const href = link.getAttribute('href');
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
      link.classList.add('active');
    } else if (href === '/' && currentPath === '/') {
      link.classList.add('active');
    }
  });

  // Show success message from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('success');
  const error = urlParams.get('error');

  if (success || error) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert ' + (success ? 'alert-success' : 'alert-error');
    alertDiv.textContent = success || error;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const pageHeader = mainContent.querySelector('.page-header');
      if (pageHeader) {
        pageHeader.insertAdjacentElement('afterend', alertDiv);
      } else {
        mainContent.insertBefore(alertDiv, mainContent.firstChild);
      }
    }

    // Clean URL
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
});
