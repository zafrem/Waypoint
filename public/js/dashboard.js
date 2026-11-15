(function() {
  const treeEl = document.getElementById('org-tree');
  if (!treeEl) return;

  const orgTree = JSON.parse(treeEl.getAttribute('data-tree'));

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // SVG Icons (Feather/Lucide style)
  const ICON_COLLAPSED = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  const ICON_EXPANDED = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  const ICON_LEAF = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle></svg>`;

  function renderNode(node, level) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = level < 2;
    const nodeId = `org-node-${node.id}`;
    const detailsId = `org-details-${node.id}`;

    let html = `<div class="org-node${hasChildren ? ' has-children' : ''}${isExpanded ? ' expanded' : ''}" id="${nodeId}">`;
    
    // Header - Now a button for accessibility if it has children, otherwise a div
    if (hasChildren) {
      html += `<button type="button" class="org-node-header" onclick="toggleNode(this)" aria-expanded="${isExpanded}" aria-controls="${detailsId}">`;
    } else {
      html += `<div class="org-node-header">`;
    }

    // Toggle Icon
    html += `<span class="org-toggle" aria-hidden="true">${hasChildren ? (isExpanded ? ICON_EXPANDED : ICON_COLLAPSED) : ICON_LEAF}</span>`;
    
    // Org Name link
    html += `<a href="/organizations/${esc(node.id)}" class="org-name" onclick="event.stopPropagation()">${esc(node.name)}</a>`;
    
    // Badges
    html += `<span class="org-badges">`;
    if (node.activeGoalCount > 0) {
      html += `<span class="badge badge-warning">${node.activeGoalCount} active</span>`;
    }
    if (node.goalCount > 0) {
      html += `<span class="badge">${node.goalCount} goals</span>`;
    }
    html += `</span>`;
    
    // Close Header
    html += hasChildren ? `</button>` : `</div>`;

    // Details/Children Container
    html += `<div id="${detailsId}" class="org-node-details" ${isExpanded ? '' : 'style="display:none"'}>`;
    
    // Leader Info
    if (node.leader) {
      html += `<div class="org-leader">`;
      html += `<span class="org-leader-label">Leader:</span> `;
      html += `<a href="/users/${esc(node.leader.id)}">${esc(node.leader.name)}</a>`;
      if (node.leader.jobFunction) {
        html += ` <span class="text-muted">(${esc(node.leader.jobFunction)})</span>`;
      }
      html += `</div>`;
    } else {
      html += `<div class="org-leader text-muted">No leader assigned</div>`;
    }

    // Children
    if (hasChildren) {
      html += `<div class="org-children">`;
      node.children.forEach(function(child) {
        html += renderNode(child, level + 1);
      });
      html += `</div>`;
    }
    
    html += `</div>`; // End details
    html += `</div>`; // End node

    return html;
  }

  let treeHtml = '';
  orgTree.forEach(function(root) {
    treeHtml += renderNode(root, 0);
  });

  treeEl.innerHTML = treeHtml || '<p class="text-muted">No organizations found.</p>';

  // Expose toggle function globally
  window.toggleNode = function(header) {
    const node = header.closest('.org-node');
    const details = node.querySelector('.org-node-details');
    const toggle = header.querySelector('.org-toggle');
    const isExpanded = header.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      node.classList.remove('expanded');
      details.style.display = 'none';
      header.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = ICON_COLLAPSED;
    } else {
      node.classList.add('expanded');
      details.style.display = 'block';
      header.setAttribute('aria-expanded', 'true');
      toggle.innerHTML = ICON_EXPANDED;
    }
  };
})();